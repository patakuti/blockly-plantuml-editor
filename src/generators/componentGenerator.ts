import * as Blockly from "blockly/core";
import { generateStatements } from "./common/statementGenerator";
import { escapeText, escapeQuotedName } from "./common/escape";

export const componentGenerator = new Blockly.CodeGenerator("PlantUMLComponent");

/**
 * Always emits braces, even for a component with no children (`component
 * "Leaf" {\n}\n`), matching activity_partition's unconditional-brace
 * generation (02_design.md 27.5) rather than conditionally omitting them.
 */
componentGenerator.forBlock["component_component"] = (block, generator) => {
  const name = escapeQuotedName(block.getFieldValue("NAME"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `component "${name}" {\n${body}}\n`;
};

componentGenerator.forBlock["component_dependency"] = (block) => {
  const from = escapeQuotedName(block.getFieldValue("FROM"));
  const to = escapeQuotedName(block.getFieldValue("TO"));
  const text = block.getFieldValue("TEXT");
  return text ? `"${from}" --> "${to}" : ${escapeText(text)}\n` : `"${from}" --> "${to}"\n`;
};

componentGenerator.forBlock["component_raw_line"] = (block) => `${block.getFieldValue("TEXT")}\n`;

const DEPENDENCY_LINE = /^"[^"]*" --> "[^"]*"(?: : .*)?$/;

/**
 * PlantUML's component-diagram renderer doesn't reliably resolve a "-->"
 * relation line while the current parse position is inside a nested
 * `component "X" { ... }` scope (02_design.md 30.1, verified against the
 * public PlantUML server): the referenced component can come back as a
 * separate, duplicate "ghost" node instead of resolving to the real one.
 * Regardless of where a Dependency block sits in the Blockly canvas
 * (including nested inside a Component, which the editor still allows), this
 * hoists every generated dependency line out of the body and re-emits them
 * all, in their original order of appearance, at the very end -- same idea
 * as hoistSwimlaneDeclarations (activityGenerator.ts), but by removing and
 * appending rather than duplicating (a "-->" line, unlike a swimlane marker,
 * is broken if left behind at its original nested position too).
 */
function hoistDependencies(body: string): string {
  const lines = body.split("\n");
  const kept: string[] = [];
  const dependencies: string[] = [];
  for (const line of lines) {
    if (DEPENDENCY_LINE.test(line)) dependencies.push(line);
    else kept.push(line);
  }
  return kept.join("\n") + dependencies.map((line) => `${line}\n`).join("");
}

/**
 * Generates full PlantUML source for the component-diagram workspace.
 *
 * Like state diagrams (stateWorkspaceToCode) and unlike
 * activityWorkspaceToCode/sequenceWorkspaceToCode's message chain, component
 * diagrams have no single "main flow": every top-level chain is walked and
 * concatenated, in position order (02_design.md 27.5).
 */
export function componentWorkspaceToCode(workspace: Blockly.Workspace): string {
  const body = workspace
    .getTopBlocks(true)
    .map((head) => generateStatements(componentGenerator, head))
    .join("");

  return `@startuml\n${hoistDependencies(body)}@enduml\n`;
}
