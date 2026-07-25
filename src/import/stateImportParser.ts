import { unescapeText } from "../generators/common/escape";
import {
  LineCursor,
  NOTE_END,
  PlantUmlImportError,
  preprocessPlantUmlSource,
  type ImportedComment,
  type NoteDirection,
} from "./common/noteBlockCursor";

/**
 * Parses PlantUML state-diagram text back into an intermediate tree
 * (02_design.md 19.2). Deliberately narrow, same spirit as
 * activityImportParser.ts/sequenceImportParser.ts: it only recognizes the
 * syntax subset stateGenerator.ts actually emits, not PlantUML's full
 * grammar. There's no separate "declaration area" vs. "graph body" split
 * here (unlike sequence diagrams) -- state/transition/composite all live in
 * one flat, ordered chain, mirroring stateGenerator.ts's single
 * STATE_STATEMENT connection type (02_design.md 18.2).
 */

export type { ImportedComment };

export type StateImportedNode =
  | { kind: "state"; name: string; comment?: ImportedComment }
  | { kind: "choice"; name: string; comment?: ImportedComment }
  | { kind: "fork"; name: string; comment?: ImportedComment }
  | { kind: "join"; name: string; comment?: ImportedComment }
  | { kind: "transition"; from: string; to: string; label?: string; comment?: ImportedComment }
  | { kind: "description"; state: string; text: string; comment?: ImportedComment }
  | { kind: "composite"; name: string; regions: StateImportedNode[][]; separators: string[]; comment?: ImportedComment }
  | { kind: "raw"; text: string; comment?: ImportedComment };

export { PlantUmlImportError };

const CHOICE = /^state\s+(\S+)\s+<<choice>>$/i;
const FORK = /^state\s+(\S+)\s+<<fork>>$/i;
const JOIN = /^state\s+(\S+)\s+<<join>>$/i;
const STATE = /^state\s+(\S+)$/i;
const COMPOSITE_OPEN = /^state\s+(\S+)\s*\{$/i;
const COMPOSITE_END = /^\}$/;
const REGION_SEPARATOR = /^(--|\|\|)$/;
const TRANSITION = /^(\S+)\s*-->\s*(\S+)(?:\s*:\s*(.*))?$/;
/** "<name> : text" (FR-STATE-19). Never collides with TRANSITION: that regex requires a literal "-->" which this one doesn't have. */
const DESCRIPTION = /^(\S+)\s*:\s*(.*)$/;
const NOTE_OF_OPEN = /^note\s+(left|right)\s+of\s+(\S+)$/i;

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
): StateImportedNode[] {
  const nodes: StateImportedNode[] = [];
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

    const noteOfMatch = NOTE_OF_OPEN.exec(trimmed);
    if (noteOfMatch) {
      attachOrRawifyNote(cursor, noteOfMatch[1].toLowerCase() as NoteDirection, unescapeText(noteOfMatch[2]), nodes);
      continue;
    }

    nodes.push(parseOneStatement(cursor));
  }
}

/**
 * Consumes a `note left/right of <name>` ... `end note` block. Unlike
 * activityImportParser.ts/sequenceImportParser.ts's bare-anchor note form
 * (common/noteBlockCursor.ts's parseNoteBlock, which attaches to whatever
 * node came immediately before, no questions asked), state diagram notes
 * always carry an explicit anchor name (02_design.md 18.5/19.1), so on
 * import that name is used as a safety check: the note is only attached as a
 * Blockly comment to the immediately preceding node if that node is a
 * state/composite AND its name matches the anchor (02_design.md 19.3,
 * FR-STATE-IMPORT-05). This also structurally prevents a note from ever
 * landing on a `transition` node, matching FR-STATE-05's UI-level
 * restriction (Transitions can't carry a comment). If the check fails
 * (no preceding node, wrong kind, name mismatch, or already commented), the
 * whole block is preserved verbatim as raw lines instead of being dropped.
 */
function attachOrRawifyNote(
  cursor: LineCursor,
  direction: NoteDirection,
  target: string,
  nodes: StateImportedNode[],
): void {
  const openLine = cursor.consumeTrimmed();
  const contentLines: string[] = [];
  while (cursor.hasMore() && !NOTE_END.test(cursor.peekTrimmed())) {
    contentLines.push(cursor.consumeTrimmed());
  }
  if (!cursor.hasMore()) {
    throw new PlantUmlImportError(`Missing "end note" for "${openLine}".`);
  }
  const endLine = cursor.consumeTrimmed();

  const last = nodes[nodes.length - 1];
  const canAttach = last !== undefined &&
    (last.kind === "state" || last.kind === "composite" || last.kind === "choice" || last.kind === "fork" || last.kind === "join") &&
    last.name === target && !last.comment;
  if (canAttach) {
    last.comment = { text: contentLines.join("\n"), direction };
    return;
  }

  nodes.push({ kind: "raw", text: openLine });
  for (const line of contentLines) nodes.push({ kind: "raw", text: line });
  nodes.push({ kind: "raw", text: endLine });
}

/**
 * Parses a Composite State's body as one or more `--`-separated concurrent
 * regions (02_design.md 22.6, FR-STATE-IMPORT-08). Each region is parsed
 * with parseStatements up to whichever comes first: another "--" (region
 * continues) or the closing "}" (left unconsumed for the caller, same as the
 * pre-Round-12 single-region behavior).
 */
function parseCompositeBody(
  cursor: LineCursor,
  openLine: string,
): { regions: StateImportedNode[][]; separators: string[] } {
  const regions: StateImportedNode[][] = [];
  const separators: string[] = [];
  while (true) {
    regions.push(
      parseStatements(
        cursor,
        (line) => COMPOSITE_END.test(line) || REGION_SEPARATOR.test(line),
        `Missing closing "}" for "${openLine}".`,
      ),
    );
    if (!REGION_SEPARATOR.test(cursor.peekTrimmed())) return { regions, separators };
    separators.push(cursor.consumeTrimmed()); // "--" or "||"
  }
}

/** Parses exactly one statement (possibly a container that recurses into parseStatements for its body). */
function parseOneStatement(cursor: LineCursor): StateImportedNode {
  const trimmed = cursor.peekTrimmed();

  const compositeOpenMatch = COMPOSITE_OPEN.exec(trimmed);
  if (compositeOpenMatch) {
    cursor.consumeTrimmed();
    const name = unescapeText(compositeOpenMatch[1]);
    const { regions, separators } = parseCompositeBody(cursor, `state ${compositeOpenMatch[1]} {`);
    cursor.consumeTrimmed(); // }
    return { kind: "composite", name, regions, separators };
  }

  const choiceMatch = CHOICE.exec(trimmed);
  if (choiceMatch) {
    cursor.consumeTrimmed();
    return { kind: "choice", name: unescapeText(choiceMatch[1]) };
  }

  const forkMatch = FORK.exec(trimmed);
  if (forkMatch) {
    cursor.consumeTrimmed();
    return { kind: "fork", name: unescapeText(forkMatch[1]) };
  }

  const joinMatch = JOIN.exec(trimmed);
  if (joinMatch) {
    cursor.consumeTrimmed();
    return { kind: "join", name: unescapeText(joinMatch[1]) };
  }

  const stateMatch = STATE.exec(trimmed);
  if (stateMatch) {
    cursor.consumeTrimmed();
    return { kind: "state", name: unescapeText(stateMatch[1]) };
  }

  const descriptionMatch = DESCRIPTION.exec(trimmed);
  if (descriptionMatch) {
    cursor.consumeTrimmed();
    return { kind: "description", state: unescapeText(descriptionMatch[1]), text: unescapeText(descriptionMatch[2]) };
  }

  const transitionMatch = TRANSITION.exec(trimmed);
  if (transitionMatch) {
    cursor.consumeTrimmed();
    const from = unescapeText(transitionMatch[1]);
    const to = unescapeText(transitionMatch[2]);
    const label = transitionMatch[3];
    return label !== undefined ? { kind: "transition", from, to, label: unescapeText(label) } : { kind: "transition", from, to };
  }

  // Unrecognized line: preserved verbatim rather than dropped (FR-STATE-IMPORT-03).
  cursor.consumeTrimmed();
  return { kind: "raw", text: trimmed };
}

export function parseStatePlantUml(source: string): StateImportedNode[] {
  const cursor = new LineCursor(preprocessPlantUmlSource(source));
  return parseStatements(cursor, () => false);
}
