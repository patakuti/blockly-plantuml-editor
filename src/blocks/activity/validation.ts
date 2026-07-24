import * as Blockly from "blockly/core";
import { flattenChain } from "../common/statementOrder";
import { pickActivityOutputChainHead } from "../../generators/activityGenerator";

export interface ActivityWarning {
  blockId: string;
  message: string;
}

/** Nested statement chains, in PlantUML output order, for If (DO0 + ELSE)/While/Repeat/Partition (DO)/Fork (each BRANCH_i). */
function activityNestedHeads(block: Blockly.Block): (Blockly.Block | null)[] {
  switch (block.type) {
    case "activity_if": {
      const heads = [block.getInputTargetBlock("DO0")];
      if (block.getInput("ELSE")) heads.push(block.getInputTargetBlock("ELSE"));
      return heads;
    }
    case "activity_while":
    case "activity_repeat":
    case "activity_partition":
      return [block.getInputTargetBlock("DO")];
    case "activity_fork": {
      const heads: (Blockly.Block | null)[] = [];
      for (let i = 0; block.getInput(`BRANCH${i}`); i++) heads.push(block.getInputTargetBlock(`BRANCH${i}`));
      return heads;
    }
    default:
      return [];
  }
}

/**
 * Re-validates the whole activity workspace:
 * - flags every `activity_start` block with a warning when more than one
 *   exists (FR-ACT-01 allows at most one). This only warns -- it does not
 *   block code generation, which always picks a single chain to output (see
 *   activityWorkspaceToCode).
 * - flags a start block whose SWIMLANE field (02_design.md 14.5) references
 *   a swimlane name that no longer has a matching `activity_swimlane` block
 *   (renamed/deleted after being picked), the same "stale reference" pattern
 *   as sequence/validation.ts's REFERENCE_FIELDS check.
 * - flags any block that falls outside the single chain
 *   activityWorkspaceToCode actually generates from (02_design.md 32.6/36.2,
 *   FR-ACT-17, generalized from FR-ACT-16's Swimlane-only version) -- e.g.
 *   sitting on a disconnected, dropped alternate chain, or placed standalone.
 *   Such a block contributes nothing to the generated PlantUML. A second,
 *   unpicked activity_start can be flagged by both this and the duplicate
 *   check above, so messages are accumulated per block ID and
 *   setWarningText() is only called once per block (same pattern as
 *   sequence/validation.ts's Round 23 fix for the same kind of overlap).
 */
export function validateActivityWorkspace(workspace: Blockly.Workspace): ActivityWarning[] {
  const messages = new Map<string, string[]>();
  const addMessage = (block: Blockly.Block, message: string) => {
    messages.set(block.id, [...(messages.get(block.id) ?? []), message]);
  };

  const startBlocks = workspace.getBlocksByType("activity_start", false);
  const swimlaneNames = new Set(
    workspace.getBlocksByType("activity_swimlane", false).map((b) => b.getFieldValue("NAME") as string),
  );

  const duplicateMessage =
    startBlocks.length > 1 ? `Only one start block is allowed; found ${startBlocks.length}.` : null;

  for (const block of startBlocks) {
    if (duplicateMessage) addMessage(block, duplicateMessage);

    const swimlane = block.getFieldValue("SWIMLANE") as string;
    if (swimlane && !swimlaneNames.has(swimlane)) {
      addMessage(block, `References a swimlane that doesn't exist: SWIMLANE="${swimlane}"`);
    }
  }

  const reachable = new Set(
    flattenChain(pickActivityOutputChainHead(workspace), activityNestedHeads).map((b) => b.id),
  );
  for (const block of workspace.getAllBlocks(false)) {
    if (!reachable.has(block.id)) {
      addMessage(block, "This block isn't part of the diagram's output chain, so it won't appear in the generated PlantUML.");
    }
  }

  const warnings: ActivityWarning[] = [];
  for (const block of workspace.getAllBlocks(false)) {
    const combined = messages.get(block.id)?.join("\n") ?? null;
    block.setWarningText(combined);
    if (combined) warnings.push({ blockId: block.id, message: combined });
  }
  return warnings;
}
