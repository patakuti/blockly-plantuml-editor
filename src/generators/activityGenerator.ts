import * as Blockly from "blockly/core";
import { generateStatements } from "./common/statementGenerator";
import { escapeText } from "./common/escape";

export const activityGenerator = new Blockly.CodeGenerator("PlantUMLActivity");

activityGenerator.forBlock["activity_start"] = () => "start\n";
activityGenerator.forBlock["activity_stop"] = () => "stop\n";
activityGenerator.forBlock["activity_action"] = (block) => {
  const text = escapeText(block.getFieldValue("TEXT"));
  return `:${text};\n`;
};
activityGenerator.forBlock["activity_if"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const thenBody = generateStatements(generator, block.getInputTargetBlock("DO0"));
  let code = `if (${cond}) then (yes)\n${thenBody}`;
  if (block.getInput("ELSE")) {
    const elseBody = generateStatements(generator, block.getInputTargetBlock("ELSE"));
    code += `else (no)\n${elseBody}`;
  }
  code += "endif\n";
  return code;
};

/**
 * Generates full PlantUML source for the activity-diagram workspace.
 * Walks the chain starting at the (always-present, fixed) start block, via
 * the same generateStatements() used for container bodies (FR-COM-06).
 */
export function activityWorkspaceToCode(workspace: Blockly.Workspace): string {
  const startBlock = workspace.getBlocksByType("activity_start", true)[0] ?? null;
  const body = generateStatements(activityGenerator, startBlock);
  return `@startuml\n${body}@enduml\n`;
}
