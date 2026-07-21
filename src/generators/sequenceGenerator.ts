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
sequenceGenerator.forBlock["sequence_raw_line"] = (block) => `${block.getFieldValue("TEXT")}\n`;

/**
 * Generates full PlantUML source for the sequence-diagram workspace.
 *
 * Participants chain together via PARTICIPANT_STATEMENT (02_design.md 12.11)
 * so they can be reordered by dragging like any other stack. There's no
 * single fixed anchor (unlike activity_start), so every top-level
 * sequence_participant chain head is walked via generateStatements() and the
 * results concatenated in top-block order (top-to-bottom); a participant
 * left disconnected from the others is still its own one-block chain and so
 * is never silently dropped. The message chain has no fixed anchor block
 * either, so the topmost non-participant statement block (message/alt/opt/
 * loop) is used as its chain head; any additional disconnected message
 * chains are not included (same class of known limitation as the
 * activity_start/stop chain-detachment case).
 */
export function sequenceWorkspaceToCode(workspace: Blockly.Workspace): string {
  const participantsCode = workspace
    .getTopBlocks(true)
    .filter((block) => block.type === "sequence_participant")
    .map((head) => generateStatements(sequenceGenerator, head))
    .join("");

  const firstStatement =
    workspace
      .getTopBlocks(true)
      .find((block) => block.type !== "sequence_participant" && block.previousConnection !== null) ?? null;
  const messagesCode = generateStatements(sequenceGenerator, firstStatement);

  return `@startuml\n${participantsCode}${messagesCode}@enduml\n`;
}
