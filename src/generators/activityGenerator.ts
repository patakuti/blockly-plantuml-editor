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
activityGenerator.forBlock["activity_partition"] = (block, generator) => {
  const name = escapeText(block.getFieldValue("NAME"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `partition ${name} {\n${body}}\n`;
};
activityGenerator.forBlock["activity_swimlane"] = (block) => {
  const name = escapeText(block.getFieldValue("NAME"));
  return `|${name}|\n`;
};

/**
 * Generates full PlantUML source for the activity-diagram workspace.
 * Walks the chain starting at the (always-present, fixed) start block, via
 * the same generateStatements() used for container bodies (FR-COM-06).
 */
export function activityWorkspaceToCode(workspace: Blockly.Workspace): string {
  const startBlock = workspace.getBlocksByType("activity_start", true)[0] ?? null;
  const body = generateStatements(activityGenerator, startBlock);
  return `@startuml\n${hoistSwimlaneDeclarations(body)}${body}@enduml\n`;
}

/**
 * PlantUML requires every swimlane (`|Name|`) to be declared before the
 * diagram's first node -- verified against the public PlantUML server
 * (2026-07-21): any `|Name|` appearing after `start` fails with "This
 * swimlane must be defined at the start of the diagram", even when it's the
 * very first statement right after `start`. Since `activity_start` is always
 * the fixed first block (FR-ACT-01), a user-placed `activity_swimlane` block
 * can never itself be the first line of the generated text.
 *
 * Re-declaring an already-declared lane elsewhere in the diagram is fine
 * (verified), so the fix is to scan the already-generated body for each
 * distinct lane name's first occurrence (in that order -- which is also what
 * determines left-to-right column order, also verified) and emit one bare
 * `|Name|` per distinct lane before `start`, ahead of the real body.
 */
function hoistSwimlaneDeclarations(body: string): string {
  let declarations = "";
  const seen = new Set<string>();
  for (const match of body.matchAll(/^\|([^|\n]+)\|$/gm)) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);
    declarations += `|${name}|\n`;
  }
  return declarations;
}
