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

/**
 * Generates full PlantUML source for the sequence-diagram workspace.
 *
 * Participants aren't a next-connection chain (see 02_design.md 5.2.1), so
 * they're generated directly in Y-position order rather than via
 * generateStatements(). The message chain has no fixed anchor block (unlike
 * activity_start), so the topmost message block is used as the chain head;
 * any additional disconnected message chains are not included (same class
 * of known limitation as the activity_start/stop chain-detachment case).
 */
export function sequenceWorkspaceToCode(workspace: Blockly.Workspace): string {
  const participantsCode = workspace
    .getBlocksByType("sequence_participant", true)
    .map((block) => sequenceGenerator.blockToCode(block, true) as string)
    .join("");

  const firstMessage =
    workspace.getTopBlocks(true).find((block) => block.type === "sequence_message") ?? null;
  const messagesCode = generateStatements(sequenceGenerator, firstMessage);

  return `@startuml\n${participantsCode}${messagesCode}@enduml\n`;
}
