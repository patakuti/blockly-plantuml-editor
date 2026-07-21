import { unescapeText } from "../generators/common/escape";

/**
 * Parses PlantUML activity-diagram text back into an intermediate tree
 * (02_design.md 15.3). Deliberately narrow: it only recognizes the syntax
 * subset activityGenerator.ts actually emits (see the pattern table below),
 * not PlantUML's full grammar. Anything it doesn't recognize becomes a
 * `{kind: "raw"}` node (01_requirements.md FR-IMPORT-03) rather than being
 * dropped, so nothing silently disappears on import.
 */

export type NoteDirection = "left" | "right";

export interface ImportedComment {
  text: string;
  direction: NoteDirection;
}

export type ImportedNode =
  | { kind: "start"; comment?: ImportedComment }
  | { kind: "stop"; comment?: ImportedComment }
  | { kind: "action"; text: string; comment?: ImportedComment }
  | {
      kind: "if";
      cond: string;
      thenLabel: string;
      thenBody: ImportedNode[];
      elseLabel?: string;
      elseBody?: ImportedNode[];
      comment?: ImportedComment;
    }
  | { kind: "while"; cond: string; body: ImportedNode[]; comment?: ImportedComment }
  | { kind: "repeat"; cond: string; body: ImportedNode[]; comment?: ImportedComment }
  | { kind: "fork"; branches: ImportedNode[][]; comment?: ImportedComment }
  | { kind: "partition"; name: string; body: ImportedNode[]; comment?: ImportedComment }
  | { kind: "swimlane"; name: string; comment?: ImportedComment }
  | { kind: "raw"; text: string; comment?: ImportedComment };

/** Thrown when the input's nesting can't be resolved (e.g. an `if` with no matching `endif`). Import is aborted wholesale on this (FR-IMPORT-04); nothing partial is built. */
export class PlantUmlImportError extends Error {}

const START = /^start$/i;
const STOP = /^stop$/i;
const ACTION = /^:(.*);$/;
const IF = /^if\s*\((.*)\)\s*then\s*\((.*)\)$/i;
const ELSE = /^else\s*\((.*)\)$/i;
const ENDIF = /^endif$/i;
const WHILE = /^while\s*\((.*)\)$/i;
const ENDWHILE = /^endwhile$/i;
const REPEAT = /^repeat$/i;
const REPEAT_WHILE = /^repeat while\s*\((.*)\)$/i;
const FORK = /^fork$/i;
const FORK_AGAIN = /^fork again$/i;
const END_FORK = /^end fork$/i;
const PARTITION = /^partition\s+(.+?)\s*\{$/i;
const PARTITION_END = /^\}$/;
const SWIMLANE = /^\|([^|]+)\|$/;
const NOTE_OPEN = /^note\s+(right|left)$/i;
const NOTE_END = /^end note$/i;

/** Strips one leading `@startuml...` line and one trailing `@enduml` line, if present. Everything else (including blank lines) is left untouched for parseStatements to walk. */
function preprocess(source: string): string[] {
  const lines = source.split(/\r\n|\r|\n/);
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  if (start < end && /^@startuml\b/i.test(lines[start].trim())) start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  if (end > start && /^@enduml$/i.test(lines[end - 1].trim())) end--;
  return lines.slice(start, end);
}

class LineCursor {
  private index = 0;
  constructor(private readonly lines: string[]) {}
  hasMore(): boolean {
    return this.index < this.lines.length;
  }
  peekTrimmed(): string {
    return this.lines[this.index].trim();
  }
  consumeTrimmed(): string {
    return this.lines[this.index++].trim();
  }
}

function attachCommentIfPossible(node: ImportedNode, comment: ImportedComment): boolean {
  if (node.comment) return false;
  node.comment = comment;
  return true;
}

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
): ImportedNode[] {
  const nodes: ImportedNode[] = [];
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

    const noteMatch = NOTE_OPEN.exec(trimmed);
    if (noteMatch) {
      parseNote(cursor, noteMatch[1].toLowerCase() as NoteDirection, nodes);
      continue;
    }

    nodes.push(parseOneStatement(cursor));
  }
}

/** Handles a `note right`/`note left` ... `end note` block, attaching it to the previously parsed node or falling back to raw lines (FR-IMPORT-06). */
function parseNote(cursor: LineCursor, direction: NoteDirection, nodes: ImportedNode[]): void {
  const openLine = cursor.consumeTrimmed();
  const contentLines: string[] = [];
  while (cursor.hasMore() && !NOTE_END.test(cursor.peekTrimmed())) {
    contentLines.push(cursor.consumeTrimmed());
  }
  if (!cursor.hasMore()) {
    throw new PlantUmlImportError(`Missing "end note" for "${openLine}".`);
  }
  const endLine = cursor.consumeTrimmed();

  const target = nodes[nodes.length - 1];
  const attached = target && attachCommentIfPossible(target, { text: contentLines.join("\n"), direction });
  if (!attached) {
    nodes.push({ kind: "raw", text: openLine });
    for (const line of contentLines) nodes.push({ kind: "raw", text: line });
    nodes.push({ kind: "raw", text: endLine });
  }
}

/** Parses exactly one statement (possibly a container that recurses into parseStatements for its body/branches). */
function parseOneStatement(cursor: LineCursor): ImportedNode {
  const trimmed = cursor.peekTrimmed();

  if (START.test(trimmed)) {
    cursor.consumeTrimmed();
    return { kind: "start" };
  }
  if (STOP.test(trimmed)) {
    cursor.consumeTrimmed();
    return { kind: "stop" };
  }

  const actionMatch = ACTION.exec(trimmed);
  if (actionMatch) {
    cursor.consumeTrimmed();
    return { kind: "action", text: unescapeText(actionMatch[1]) };
  }

  const ifMatch = IF.exec(trimmed);
  if (ifMatch) {
    cursor.consumeTrimmed();
    const cond = unescapeText(ifMatch[1].trim());
    const thenLabel = unescapeText(ifMatch[2].trim());
    const thenBody = parseStatements(
      cursor,
      (line) => ELSE.test(line) || ENDIF.test(line),
      `Missing "endif" for "if (${ifMatch[1]}) then (${ifMatch[2]})".`,
    );

    let elseLabel: string | undefined;
    let elseBody: ImportedNode[] | undefined;
    if (cursor.hasMore() && ELSE.test(cursor.peekTrimmed())) {
      const elseMatch = ELSE.exec(cursor.consumeTrimmed())!;
      elseLabel = unescapeText(elseMatch[1].trim());
      elseBody = parseStatements(
        cursor,
        (line) => ENDIF.test(line),
        `Missing "endif" for "if (${ifMatch[1]}) then (${ifMatch[2]})".`,
      );
    }
    cursor.consumeTrimmed(); // endif
    return elseBody !== undefined
      ? { kind: "if", cond, thenLabel, thenBody, elseLabel, elseBody }
      : { kind: "if", cond, thenLabel, thenBody };
  }

  const whileMatch = WHILE.exec(trimmed);
  if (whileMatch) {
    cursor.consumeTrimmed();
    const cond = unescapeText(whileMatch[1].trim());
    const body = parseStatements(
      cursor,
      (line) => ENDWHILE.test(line),
      `Missing "endwhile" for "while (${whileMatch[1]})".`,
    );
    cursor.consumeTrimmed(); // endwhile
    return { kind: "while", cond, body };
  }

  if (REPEAT.test(trimmed)) {
    cursor.consumeTrimmed();
    const body = parseStatements(
      cursor,
      (line) => REPEAT_WHILE.test(line),
      'Missing "repeat while (...)" for "repeat".',
    );
    const repeatWhileMatch = REPEAT_WHILE.exec(cursor.consumeTrimmed())!;
    const cond = unescapeText(repeatWhileMatch[1].trim());
    return { kind: "repeat", cond, body };
  }

  if (FORK.test(trimmed)) {
    cursor.consumeTrimmed();
    const branches: ImportedNode[][] = [];
    const isBranchTerminator = (line: string) => FORK_AGAIN.test(line) || END_FORK.test(line);
    branches.push(parseStatements(cursor, isBranchTerminator, 'Missing "end fork" for "fork".'));
    while (cursor.hasMore() && FORK_AGAIN.test(cursor.peekTrimmed())) {
      cursor.consumeTrimmed();
      branches.push(parseStatements(cursor, isBranchTerminator, 'Missing "end fork" for "fork".'));
    }
    cursor.consumeTrimmed(); // end fork
    return { kind: "fork", branches };
  }

  const partitionMatch = PARTITION.exec(trimmed);
  if (partitionMatch) {
    cursor.consumeTrimmed();
    const name = unescapeText(partitionMatch[1].trim());
    const body = parseStatements(
      cursor,
      (line) => PARTITION_END.test(line),
      `Missing closing "}" for "partition ${partitionMatch[1]} {".`,
    );
    cursor.consumeTrimmed(); // }
    return { kind: "partition", name, body };
  }

  const swimlaneMatch = SWIMLANE.exec(trimmed);
  if (swimlaneMatch) {
    cursor.consumeTrimmed();
    return { kind: "swimlane", name: unescapeText(swimlaneMatch[1].trim()) };
  }

  // Unrecognized line: preserved verbatim rather than dropped (FR-IMPORT-03).
  cursor.consumeTrimmed();
  return { kind: "raw", text: trimmed };
}

export function parseActivityPlantUml(source: string): ImportedNode[] {
  const cursor = new LineCursor(preprocess(source));
  return parseStatements(cursor, () => false);
}
