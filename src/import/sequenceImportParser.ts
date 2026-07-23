import { unescapeText } from "../generators/common/escape";
import {
  LineCursor,
  PlantUmlImportError,
  matchNoteOpen,
  parseNoteBlock,
  preprocessPlantUmlSource,
  type ImportedComment,
} from "./common/noteBlockCursor";

/**
 * Parses PlantUML sequence-diagram text back into an intermediate tree
 * (02_design.md 16.3). Deliberately narrow, same spirit as
 * activityImportParser.ts: it only recognizes the syntax subset
 * sequenceGenerator.ts actually emits, not PlantUML's full grammar. There's
 * no separate grammar for "the participant declaration area" -- the source
 * is walked as a single flat, ordered list of nodes (participant/actor/
 * message/alt/opt/loop/note/raw), exactly mirroring how sequenceGenerator.ts
 * itself just concatenates a participant/actor-chain and a message-chain one
 * after the other. Splitting that flat list into the two chains is
 * sequenceImportBuilder.ts's job.
 */

export type { ImportedComment };

export type SequenceImportedNode =
  | { kind: "participant"; name: string; comment?: ImportedComment }
  | { kind: "actor"; name: string; comment?: ImportedComment }
  | { kind: "message"; from: string; to: string; text: string; comment?: ImportedComment }
  | {
      kind: "alt";
      cond: string;
      body: SequenceImportedNode[];
      elseBranches: { cond: string; body: SequenceImportedNode[] }[];
      comment?: ImportedComment;
    }
  | { kind: "opt"; cond: string; body: SequenceImportedNode[]; comment?: ImportedComment }
  | { kind: "loop"; cond: string; body: SequenceImportedNode[]; comment?: ImportedComment }
  | { kind: "note"; side: "left" | "right"; target: string; text: string; comment?: ImportedComment }
  | { kind: "raw"; text: string; comment?: ImportedComment };

export { PlantUmlImportError };

const PARTICIPANT = /^participant\s+"(.*)"$/i;
const ACTOR = /^actor\s+"(.*)"$/i;
const MESSAGE = /^"(.*)"\s*->\s*"(.*)":\s(.*)$/;
const ALT = /^alt\s*\((.*)\)$/i;
const ELSE = /^else\s*\((.*)\)$/i;
const OPT = /^opt\s*\((.*)\)$/i;
const LOOP = /^loop\s*\((.*)\)$/i;
const END = /^end$/i;
const NOTE_OF = /^note\s+(left|right)\s+of\s+"(.*)":\s(.*)$/i;

/**
 * Consumes lines until `isTerminator` matches the next line (which is left
 * unconsumed) or, if `unterminatedMessage` is set, throws when input runs out
 * first. The top-level call passes no message, since running out of input is
 * simply "end of diagram" there.
 */
function parseStatements(
  cursor: LineCursor,
  isTerminator: (trimmedLine: string) => boolean,
  unterminatedMessage?: string,
): SequenceImportedNode[] {
  const nodes: SequenceImportedNode[] = [];
  while (true) {
    if (!cursor.hasMore()) {
      if (unterminatedMessage) throw new PlantUmlImportError(unterminatedMessage);
      return nodes;
    }
    const trimmed = cursor.peekTrimmed();
    if (isTerminator(trimmed)) return nodes;
    if (trimmed === "") {
      cursor.consumeTrimmed();
      continue;
    }

    const noteOfMatch = NOTE_OF.exec(trimmed);
    if (noteOfMatch) {
      cursor.consumeTrimmed();
      nodes.push({
        kind: "note",
        side: noteOfMatch[1].toLowerCase() as "left" | "right",
        target: unescapeText(noteOfMatch[2]),
        text: unescapeText(noteOfMatch[3]),
      });
      continue;
    }

    const noteDirection = matchNoteOpen(trimmed);
    if (noteDirection) {
      parseNoteBlock(cursor, noteDirection, nodes, (text): SequenceImportedNode => ({ kind: "raw", text }));
      continue;
    }

    nodes.push(parseOneStatement(cursor));
  }
}

/** Parses exactly one statement (possibly a container that recurses into parseStatements for its body/branches). */
function parseOneStatement(cursor: LineCursor): SequenceImportedNode {
  const trimmed = cursor.peekTrimmed();

  const participantMatch = PARTICIPANT.exec(trimmed);
  if (participantMatch) {
    cursor.consumeTrimmed();
    return { kind: "participant", name: unescapeText(participantMatch[1]) };
  }

  const actorMatch = ACTOR.exec(trimmed);
  if (actorMatch) {
    cursor.consumeTrimmed();
    return { kind: "actor", name: unescapeText(actorMatch[1]) };
  }

  const messageMatch = MESSAGE.exec(trimmed);
  if (messageMatch) {
    cursor.consumeTrimmed();
    return {
      kind: "message",
      from: unescapeText(messageMatch[1]),
      to: unescapeText(messageMatch[2]),
      text: unescapeText(messageMatch[3]),
    };
  }

  const altMatch = ALT.exec(trimmed);
  if (altMatch) {
    cursor.consumeTrimmed();
    const cond = unescapeText(altMatch[1].trim());
    const body = parseStatements(
      cursor,
      (line) => ELSE.test(line) || END.test(line),
      `Missing "end" for "alt (${altMatch[1]})".`,
    );
    const elseBranches: { cond: string; body: SequenceImportedNode[] }[] = [];
    while (cursor.hasMore() && ELSE.test(cursor.peekTrimmed())) {
      const elseMatch = ELSE.exec(cursor.consumeTrimmed())!;
      const elseCond = unescapeText(elseMatch[1].trim());
      const elseBody = parseStatements(
        cursor,
        (line) => ELSE.test(line) || END.test(line),
        `Missing "end" for "alt (${altMatch[1]})".`,
      );
      elseBranches.push({ cond: elseCond, body: elseBody });
    }
    cursor.consumeTrimmed(); // end
    return { kind: "alt", cond, body, elseBranches };
  }

  const optMatch = OPT.exec(trimmed);
  if (optMatch) {
    cursor.consumeTrimmed();
    const cond = unescapeText(optMatch[1].trim());
    const body = parseStatements(cursor, (line) => END.test(line), `Missing "end" for "opt (${optMatch[1]})".`);
    cursor.consumeTrimmed(); // end
    return { kind: "opt", cond, body };
  }

  const loopMatch = LOOP.exec(trimmed);
  if (loopMatch) {
    cursor.consumeTrimmed();
    const cond = unescapeText(loopMatch[1].trim());
    const body = parseStatements(cursor, (line) => END.test(line), `Missing "end" for "loop (${loopMatch[1]})".`);
    cursor.consumeTrimmed(); // end
    return { kind: "loop", cond, body };
  }

  // Unrecognized line: preserved verbatim rather than dropped (FR-SEQ-IMPORT-03).
  cursor.consumeTrimmed();
  return { kind: "raw", text: trimmed };
}

export function parseSequencePlantUml(source: string): SequenceImportedNode[] {
  const cursor = new LineCursor(preprocessPlantUmlSource(source));
  return parseStatements(cursor, () => false);
}
