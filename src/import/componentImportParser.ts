import { unescapeText } from "../generators/common/escape";
import { LineCursor, PlantUmlImportError, preprocessPlantUmlSource } from "./common/noteBlockCursor";

/**
 * Parses PlantUML component-diagram text back into an intermediate tree
 * (02_design.md 28.2). Deliberately narrow: it only recognizes the syntax
 * subset componentGenerator.ts actually emits (component containment and
 * dependency lines), not PlantUML's full grammar. Anything it doesn't
 * recognize -- including `note ... end note`, which componentGenerator.ts
 * never emits (unlike activity/sequence/state) -- becomes a `{kind: "raw"}`
 * node (01_requirements.md FR-COMP-IMPORT-03) rather than being dropped.
 */

export type ComponentImportedNode =
  | { kind: "component"; name: string; body: ComponentImportedNode[] }
  | { kind: "dependency"; from: string; to: string; text?: string }
  | { kind: "raw"; text: string };

export { PlantUmlImportError };

const COMPONENT_OPEN = /^component\s+"(.*)"\s*\{$/i;
const COMPONENT_END = /^\}$/;
const DEPENDENCY = /^"(.*)"\s*-->\s*"(.*)"(?:\s*:\s*(.*))?$/;

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
): ComponentImportedNode[] {
  const nodes: ComponentImportedNode[] = [];
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

    nodes.push(parseOneStatement(cursor));
  }
}

/** Parses exactly one statement (a component, which recurses into parseStatements for its body; a dependency; or a raw line). */
function parseOneStatement(cursor: LineCursor): ComponentImportedNode {
  const trimmed = cursor.peekTrimmed();

  const componentMatch = COMPONENT_OPEN.exec(trimmed);
  if (componentMatch) {
    cursor.consumeTrimmed();
    const name = unescapeText(componentMatch[1].trim());
    const body = parseStatements(
      cursor,
      (line) => COMPONENT_END.test(line),
      `Missing closing "}" for "component "${componentMatch[1]}" {".`,
    );
    cursor.consumeTrimmed(); // }
    return { kind: "component", name, body };
  }

  const dependencyMatch = DEPENDENCY.exec(trimmed);
  if (dependencyMatch) {
    cursor.consumeTrimmed();
    const from = unescapeText(dependencyMatch[1]);
    const to = unescapeText(dependencyMatch[2]);
    const text = dependencyMatch[3];
    return text !== undefined
      ? { kind: "dependency", from, to, text: unescapeText(text) }
      : { kind: "dependency", from, to };
  }

  // Unrecognized line: preserved verbatim rather than dropped (FR-COMP-IMPORT-03).
  cursor.consumeTrimmed();
  return { kind: "raw", text: trimmed };
}

export function parseComponentPlantUml(source: string): ComponentImportedNode[] {
  const cursor = new LineCursor(preprocessPlantUmlSource(source));
  return parseStatements(cursor, () => false);
}
