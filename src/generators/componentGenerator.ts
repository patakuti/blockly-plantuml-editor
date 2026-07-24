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

  return `@startuml\n${body}@enduml\n`;
}
