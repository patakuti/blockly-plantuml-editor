/**
 * Shared line-walking primitives for the PlantUML import parsers
 * (02_design.md 16.2). Extracted out of activityImportParser.ts because
 * sequenceImportParser.ts needs byte-identical behavior for walking lines and
 * for attaching a `note right`/`note left` ... `end note` block to the
 * previously parsed node (falling back to raw lines when there's no node to
 * attach to, or it already has a comment) -- the two parsers only differ in
 * the shape of their own `ImportedNode` union.
 */

export type NoteDirection = "left" | "right";

export interface ImportedComment {
  text: string;
  direction: NoteDirection;
}

const NOTE_OPEN = /^note\s+(right|left)$/i;
const NOTE_END = /^end note$/i;

export class LineCursor {
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

/** Thrown when the input's nesting can't be resolved. Import is aborted wholesale on this (FR-IMPORT-04); nothing partial is built. */
export class PlantUmlImportError extends Error {}

/**
 * Strips an optional wrapping Markdown code fence (```` ```plantuml ```` /
 * ```` ``` ```` ... ```` ``` ````, the format `previewPanel.ts`'s "Copy as
 * Markdown" button produces, FR-SAVE-07) and then one leading `@startuml...`
 * line and one trailing `@enduml` line, if present (both diagram types'
 * generators always wrap their output this way, but neither wrapper is
 * required for a paste to parse). Blank lines around each wrapper are
 * skipped when looking for it, but otherwise left untouched for the
 * parser's own `parseStatements` to walk.
 */
export function preprocessPlantUmlSource(source: string): string[] {
  return stripWrapper(stripWrapper(source.split(/\r\n|\r|\n/), /^```\w*$/, /^```$/), /^@startuml\b/i, /^@enduml$/i);
}

function stripWrapper(lines: string[], openPattern: RegExp, closePattern: RegExp): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  if (start < end && openPattern.test(lines[start].trim())) start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  if (end > start && closePattern.test(lines[end - 1].trim())) end--;
  return lines.slice(start, end);
}

/** Matches a bare `note right`/`note left` line (no `of "X":` suffix). Exported so callers can dispatch to {@link parseNoteBlock} vs. their own single-line note form. */
export function matchNoteOpen(trimmedLine: string): NoteDirection | null {
  const match = NOTE_OPEN.exec(trimmedLine);
  return match ? (match[1].toLowerCase() as NoteDirection) : null;
}

function attachCommentIfPossible<T extends { comment?: ImportedComment }>(
  node: T,
  comment: ImportedComment,
): boolean {
  if (node.comment) return false;
  node.comment = comment;
  return true;
}

/**
 * Consumes a `note right`/`note left` ... `end note` block. If the
 * previously parsed node (the last element of `nodes`) exists and doesn't
 * already have a comment, attaches this note to it as a Blockly comment
 * (FR-IMPORT-06/FR-SEQ-IMPORT-06). Otherwise falls back to pushing the open
 * line, each content line, and the end line as individual raw nodes via
 * `makeRaw`, so nothing is silently dropped.
 */
export function parseNoteBlock<T extends { comment?: ImportedComment }>(
  cursor: LineCursor,
  direction: NoteDirection,
  nodes: T[],
  makeRaw: (text: string) => T,
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

  const target = nodes[nodes.length - 1] as T | undefined;
  const attached = target && attachCommentIfPossible(target, { text: contentLines.join("\n"), direction });
  if (!attached) {
    nodes.push(makeRaw(openLine));
    for (const line of contentLines) nodes.push(makeRaw(line));
    nodes.push(makeRaw(endLine));
  }
}
