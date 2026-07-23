import * as Blockly from "blockly/core";
import { flattenChain } from "../common/statementOrder";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";
import { consumeEligibility } from "../common/autoDefaultTracking";

/** Nested statement chains, in PlantUML output order, for Alt (DO0 + each ELSE_BODY_i)/Opt/Loop (DO). */
function sequenceNestedHeads(block: Blockly.Block): (Blockly.Block | null)[] {
  if (block.type === "sequence_alt") {
    const heads = [block.getInputTargetBlock("DO0")];
    for (let i = 1; block.getInput(`ELSE_BODY_${i}`); i++) {
      heads.push(block.getInputTargetBlock(`ELSE_BODY_${i}`));
    }
    return heads;
  }
  if (block.type === "sequence_opt" || block.type === "sequence_loop") {
    return [block.getInputTargetBlock("DO")];
  }
  return [];
}

/** Same "topmost non-participant statement" head search as sequenceGenerator.ts's sequenceWorkspaceToCode. */
function messageChainHead(workspace: Blockly.Workspace): Blockly.Block | null {
  return (
    workspace
      .getTopBlocks(true)
      .find((b) => b.type !== "sequence_participant" && b.previousConnection !== null) ?? null
  );
}

function firstParticipantName(workspace: Blockly.Workspace): string | undefined {
  return workspace.getBlocksByType("sequence_participant", true)[0]?.getFieldValue("NAME") as
    | string
    | undefined;
}

function applyParticipant(block: Blockly.Block, name: string): void {
  if (block.type === "sequence_message") {
    setFieldValueRefreshingDropdown(block, "FROM", name);
    setFieldValueRefreshingDropdown(block, "TO", name);
  } else {
    setFieldValueRefreshingDropdown(block, "TARGET", name);
  }
}

/** Whether any other sequence_message block exists anywhere in the workspace, connected or not. */
function anyOtherMessageExists(workspace: Blockly.Workspace, block: Blockly.Block): boolean {
  return workspace.getBlocksByType("sequence_message", false).some((b) => b.id !== block.id);
}

/**
 * FR-SEQ-15/16 (02_design.md 24.7): when a genuinely new Message or Note
 * makes its first connection, default FROM/TO (or TARGET) to the recipient
 * of the nearest preceding Message in PlantUML output order, searching
 * across Alt/Opt/Loop nesting. Falls back to the first declared Participant
 * only when this is confirmed to be the only Message in the whole workspace
 * -- this also fixes a pre-existing bug (02_design.md 24.7a) where a freshly
 * dropped sequence_message's FROM/TO stayed empty even with participants
 * already declared, because the dynamic dropdown's option cache is computed
 * while the block is still unattached (getSourceBlock() null) and never
 * refreshed afterward. sequence_note isn't affected by that bug (FR-SEQ-10
 * already sets it explicitly in init()), but re-applying the same fallback
 * here is harmless.
 *
 * A block dropped standalone while other Messages already exist elsewhere
 * (in a different, not-yet-connected chain) has nothing conclusive to
 * search yet: it isn't the workspace's only Message, but it also has no
 * preceding Message in its own (single-block) chain. Rather than guessing,
 * this leaves it eligible (does not call consumeEligibility) so that a
 * later move that actually connects it to a real chain still finds its true
 * preceding Message instead of being stuck with an early guess.
 */
export function applySequenceAutoDefault(workspace: Blockly.Workspace, block: Blockly.Block): void {
  if (block.type !== "sequence_message" && block.type !== "sequence_note") return;

  const ordered = flattenChain(messageChainHead(workspace), sequenceNestedHeads);
  const index = ordered.indexOf(block);
  for (let i = index - 1; i >= 0; i--) {
    if (ordered[i].type === "sequence_message") {
      applyParticipant(block, ordered[i].getFieldValue("TO") as string);
      consumeEligibility(block.id);
      return;
    }
  }

  if (anyOtherMessageExists(workspace, block)) return; // inconclusive; stay eligible for a later connection

  const first = firstParticipantName(workspace);
  if (first !== undefined) applyParticipant(block, first);
  consumeEligibility(block.id);
}
