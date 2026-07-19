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
  const thenLabel = escapeText(block.getFieldValue("THEN_LABEL"));
  const thenBody = generateStatements(generator, block.getInputTargetBlock("DO0"));
  let code = `if (${cond}) then (${thenLabel})\n${thenBody}`;
  if (block.getInput("ELSE")) {
    const elseLabel = escapeText(block.getFieldValue("ELSE_LABEL"));
    const elseBody = generateStatements(generator, block.getInputTargetBlock("ELSE"));
    code += `else (${elseLabel})\n${elseBody}`;
  }
  code += "endif\n";
  return code;
};
activityGenerator.forBlock["activity_while"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `while (${cond})\n${body}endwhile\n`;
};
activityGenerator.forBlock["activity_repeat"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `repeat\n${body}repeat while (${cond})\n`;
};
activityGenerator.forBlock["activity_fork"] = (block, generator) => {
  const branches: string[] = [];
  for (let i = 0; block.getInput(`BRANCH${i}`); i++) {
    branches.push(generateStatements(generator, block.getInputTargetBlock(`BRANCH${i}`)));
  }
  return `fork\n${branches.join("fork again\n")}end fork\n`;
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
