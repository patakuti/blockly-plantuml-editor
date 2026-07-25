import * as Blockly from "blockly/core";
import { generateStatements } from "./common/statementGenerator";
import { escapeText } from "./common/escape";

export const stateGenerator = new Blockly.CodeGenerator("PlantUMLState");

/**
 * Only state_state/state_composite/state_choice get a note anchor (their own
 * name); state_transition returns undefined so any comment on it would fall
 * back to the implicit note form. That fallback is never reached in practice
 * because blocks/state/noteRestriction.ts hides the "Add Comment" menu item
 * on state_transition entirely (02_design.md 18.5: the implicit form was
 * verified to sometimes break PlantUML rendering right after a transition).
 */
function stateNoteAnchor(block: Blockly.Block): string | undefined {
  if (
    block.type === "state_state" ||
    block.type === "state_composite" ||
    block.type === "state_choice" ||
    block.type === "state_fork" ||
    block.type === "state_join"
  ) {
    return escapeText(block.getFieldValue("NAME"));
  }
  return undefined;
}

stateGenerator.forBlock["state_state"] = (block) => `state ${escapeText(block.getFieldValue("NAME"))}\n`;

stateGenerator.forBlock["state_choice"] = (block) =>
  `state ${escapeText(block.getFieldValue("NAME"))} <<choice>>\n`;

stateGenerator.forBlock["state_fork"] = (block) =>
  `state ${escapeText(block.getFieldValue("NAME"))} <<fork>>\n`;

stateGenerator.forBlock["state_join"] = (block) =>
  `state ${escapeText(block.getFieldValue("NAME"))} <<join>>\n`;

stateGenerator.forBlock["state_transition"] = (block) => {
  const from = escapeText(block.getFieldValue("FROM"));
  const to = escapeText(block.getFieldValue("TO"));
  const label = block.getFieldValue("LABEL");
  return label ? `${from} --> ${to} : ${escapeText(label)}\n` : `${from} --> ${to}\n`;
};

/**
 * DO is the always-present first region; REGION1, REGION2, ... are added by
 * the state_region_mutator (02_design.md 22.3/22.4). With no extra regions
 * (the common case, and the only case before Round 12), this generates
 * exactly the same output as before: a single body with no "--" separator.
 */
stateGenerator.forBlock["state_composite"] = (block, generator) => {
  const name = escapeText(block.getFieldValue("NAME"));
  let body = generateStatements(generator, block.getInputTargetBlock("DO"), stateNoteAnchor);
  const separator = block.getFieldValue("SEPARATOR") as string;
  let i = 1;
  while (block.getInput(`REGION${i}`)) {
    body += `${separator}\n${generateStatements(generator, block.getInputTargetBlock(`REGION${i}`), stateNoteAnchor)}`;
    i++;
  }
  return `state ${name} {\n${body}}\n`;
};

stateGenerator.forBlock["state_raw_line"] = (block) => `${block.getFieldValue("TEXT")}\n`;

/**
 * Generates full PlantUML source for the state-diagram workspace.
 *
 * Unlike activityWorkspaceToCode/sequenceWorkspaceToCode's message chain,
 * which pick a single top-level chain to output (there's one "main flow"),
 * state diagrams are graphs with no such primary flow: users naturally split
 * states/transitions across several disconnected chains, and silently
 * dropping all but one would be surprising. So every top-level chain is
 * walked and concatenated, in position order (02_design.md 18.4).
 */
export function stateWorkspaceToCode(workspace: Blockly.Workspace): string {
  const body = workspace
    .getTopBlocks(true)
    .map((head) => generateStatements(stateGenerator, head, stateNoteAnchor))
    .join("");

  return `@startuml\n${body}@enduml\n`;
}
