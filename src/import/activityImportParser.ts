import { unescapeText } from "../generators/common/escape";
import {
  LineCursor,
  PlantUmlImportError,
  matchNoteOpen,
  parseNoteBlock,
  preprocessPlantUmlSource,
  type ImportedComment,
  type NoteDirection,
} from "./common/noteBlockCursor";

/**
 * Parses PlantUML activity-diagram text back into an intermediate tree
 * (02_design.md 15.3). Deliberately narrow: it only recognizes the syntax
 * subset activityGenerator.ts actually emits (see the pattern table below),
 * not PlantUML's full grammar. Anything it doesn't recognize becomes a
 * `{kind: "raw"}` node (01_requirements.md FR-IMPORT-03) rather than being
 * dropped, so nothing silently disappears on import.
 */

export type { NoteDirection, ImportedComment };

export type ImportedNode =
  | { kind: "start"; pinnedSwimlane?: string; comment?: ImportedComment }
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

export { PlantUmlImportError };

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

    const noteDirection = matchNoteOpen(trimmed);
    if (noteDirection) {
      parseNoteBlock(cursor, noteDirection, nodes, (text): ImportedNode => ({ kind: "raw", text }));
      continue;
    }

    nodes.push(parseOneStatement(cursor));
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

/** The nested statement bodies (if any) of a single node, for recursing into containers. */
function childBodies(node: ImportedNode): ImportedNode[][] {
  switch (node.kind) {
    case "if":
      return node.elseBody ? [node.thenBody, node.elseBody] : [node.thenBody];
    case "while":
    case "repeat":
    case "partition":
      return [node.body];
    case "fork":
      return node.branches;
    default:
      return [];
  }
}

/**
 * Recursively collects swimlane names in document order, deduplicated by
 * first occurrence -- mirrors hoistSwimlaneDeclarations' own scan
 * (activityGenerator.ts), which regex-scans the flat generated text
 * (including inside containers, since generateStatements never indents).
 * Used by stripHoistedPreamble (02_design.md 32.3/32.4) to recognize the
 * generator's own hoisted preamble on import.
 */
function collectSwimlaneOrder(nodes: ImportedNode[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (list: ImportedNode[]) => {
    for (const node of list) {
      if (node.kind === "swimlane" && !seen.has(node.name)) {
        seen.add(node.name);
        order.push(node.name);
      }
      for (const body of childBodies(node)) visit(body);
    }
  };
  visit(nodes);
  return order;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Whether `leading` is exactly hoistSwimlaneDeclarations' output shape for `used`: itself (no pin), or itself plus one extra trailing name (the pin). */
function matchesHoistShape(leading: string[], used: string[]): { pinnedSwimlane?: string } | null {
  if (sameOrder(leading, used)) return {};
  if (used.length > 0 && leading.length === used.length + 1 && sameOrder(leading.slice(0, used.length), used)) {
    return { pinnedSwimlane: leading[leading.length - 1] };
  }
  return null;
}

/**
 * Strips a leading run of `swimlane` nodes that exactly matches
 * hoistSwimlaneDeclarations' own output shape (02_design.md 32.3): either
 * the deduplicated, first-occurrence-order list of swimlane names actually
 * used in the rest of the diagram (no pin), or that same list with one
 * extra trailing name (the pinned lane, FR-ACT-11 -- appended
 * unconditionally by the generator regardless of whether it's already in
 * the list). Recovers the pinned lane as `pinnedSwimlane` when present.
 *
 * Falls back to leaving `nodes` untouched whenever no split of the leading
 * run matches either shape -- e.g. hand-written or externally-produced
 * PlantUML that merely happens to open with `|Name|` declarations. This
 * fixes 32.2's bug (orphaned Swimlane blocks left on the canvas after an
 * import, since `activity_start` has no previousStatement for the chain
 * builder to connect the hoisted declarations into) without risking
 * silently dropping content this app didn't itself generate.
 *
 * Tries the longest leading run first, then progressively shorter prefixes:
 * when there's no `start` block (FR-ACT-01) and the diagram's very first
 * real statement is itself a swimlane switch, that first switch is
 * syntactically indistinguishable from the hoisted preamble in front of it
 * (both are just more `|Name|` lines), so the two runs together look like
 * one long run of leading swimlane nodes. Shrinking the candidate preamble
 * one node at a time until the shape matches correctly finds the true
 * boundary in that case (moving the real first switch back into `rest`,
 * where `used` picks it up) instead of over-consuming it.
 *
 * The pin shape additionally requires at least one lane actually used
 * elsewhere (`used.length > 0`): without this guard, a single leading
 * `|Name|` followed by content that never mentions that name again (`used`
 * empty) is genuinely ambiguous with an ordinary, non-hoisted, one-lane
 * PlantUML snippet a human might ordinarily write (confirmed by an existing
 * parser test using exactly that shape) -- there is no textual way to tell
 * apart "pinned to a lane nothing else uses" from "just one plain swimlane
 * declaration" for a single, non-repeated line, so this deliberately favors
 * *not* stripping it (the safe side per this function's own doc comment)
 * over restoring an unusual pin.
 */
function stripHoistedPreamble(nodes: ImportedNode[]): { nodes: ImportedNode[]; pinnedSwimlane?: string } {
  let runLength = 0;
  while (runLength < nodes.length && nodes[runLength].kind === "swimlane") runLength++;

  for (let k = runLength; k >= 1; k--) {
    const leading = nodes.slice(0, k).map((node) => (node as { kind: "swimlane"; name: string }).name);
    const rest = nodes.slice(k);
    const used = collectSwimlaneOrder(rest);
    const match = matchesHoistShape(leading, used);
    if (match) return { nodes: rest, ...match };
  }
  return { nodes };
}

export function parseActivityPlantUml(source: string): ImportedNode[] {
  const cursor = new LineCursor(preprocessPlantUmlSource(source));
  const nodes = parseStatements(cursor, () => false);
  const { nodes: stripped, pinnedSwimlane } = stripHoistedPreamble(nodes);
  if (pinnedSwimlane === undefined) return stripped;

  const [head, ...tail] = stripped;
  if (!head || head.kind !== "start") return stripped;
  return [{ ...head, pinnedSwimlane }, ...tail];
}
