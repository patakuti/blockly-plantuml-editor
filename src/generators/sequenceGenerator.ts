import * as Blockly from "blockly/core";
import { generateStatements } from "./common/statementGenerator";
import { escapeText, escapeQuotedName } from "./common/escape";

export const sequenceGenerator = new Blockly.CodeGenerator("PlantUMLSequence");

sequenceGenerator.forBlock["sequence_participant"] = (block) => {
  const name = escapeQuotedName(block.getFieldValue("NAME"));
  return `participant "${name}"\n`;
};
sequenceGenerator.forBlock["sequence_message"] = (block) => {
  const from = escapeQuotedName(block.getFieldValue("FROM"));
  const to = escapeQuotedName(block.getFieldValue("TO"));
  const text = escapeText(block.getFieldValue("TEXT"));
  return `"${from}" -> "${to}": ${text}\n`;
};
sequenceGenerator.forBlock["sequence_alt"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  let code = `alt (${cond})\n`;
  code += generateStatements(generator, block.getInputTargetBlock("DO0"));
  for (let i = 1; block.getInput(`ELSE_LABEL_${i}`); i++) {
    const elseCond = escapeText(block.getFieldValue(`ELSE_COND_${i}`));
    code += `else (${elseCond})\n`;
    code += generateStatements(generator, block.getInputTargetBlock(`ELSE_BODY_${i}`));
  }
  code += "end\n";
  return code;
};
sequenceGenerator.forBlock["sequence_opt"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `opt (${cond})\n${body}end\n`;
};
sequenceGenerator.forBlock["sequence_loop"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `loop (${cond})\n${body}end\n`;
};
sequenceGenerator.forBlock["sequence_note"] = (block) => {
  const side = block.getFieldValue("SIDE");
  const target = escapeQuotedName(block.getFieldValue("TARGET"));
  const text = escapeText(block.getFieldValue("TEXT"));
  return `note ${side} of "${target}": ${text}\n`;
};

/**
 * Generates full PlantUML source for the sequence-diagram workspace.
 *
 * Participants aren't a next-connection chain (see 02_design.md 5.2.1), so
 * they're generated directly in Y-position order rather than via
 * generateStatements(). The message chain has no fixed anchor block (unlike
 * activity_start), so the topmost statement block (message/alt/opt/loop) is
 * used as the chain head; any additional disconnected chains are not
 * included (same class of known limitation as the activity_start/stop
 * chain-detachment case).
 */
export function sequenceWorkspaceToCode(workspace: Blockly.Workspace): string {
  const participantsCode = workspace
    .getBlocksByType("sequence_participant", true)
    .map((block) => sequenceGenerator.blockToCode(block, true) as string)
    .join("");

  const firstStatement =
    workspace.getTopBlocks(true).find((block) => block.previousConnection !== null) ?? null;
  const messagesCode = generateStatements(sequenceGenerator, firstStatement);

  return `@startuml\n${participantsCode}${messagesCode}@enduml\n`;
}
