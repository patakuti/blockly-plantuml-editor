import * as Blockly from "blockly/core";
import { flattenChain } from "../common/statementOrder";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";
import { consumeEligibility } from "../common/autoDefaultTracking";

/** Nested statement chains, in PlantUML output order, for Composite State (DO + each REGION_i). */
function stateNestedHeads(block: Blockly.Block): (Blockly.Block | null)[] {
  if (block.type !== "state_composite") return [];
  const heads = [block.getInputTargetBlock("DO")];
  for (let i = 1; block.getInput(`REGION${i}`); i++) {
    heads.push(block.getInputTargetBlock(`REGION${i}`));
  }
  return heads;
}

function isNameable(block: Blockly.Block): boolean {
  return (
    block.type === "state_state" ||
    block.type === "state_composite" ||
    block.type === "state_choice" ||
    block.type === "state_fork" ||
    block.type === "state_join"
  );
}

/**
 * FR-STATE-11 (02_design.md 24.8): when a genuinely new Transition makes its
 * first *actual* connection (previous or next, including into a Composite
 * State's DO/REGION input), default FROM to the name of the nearest
 * preceding State/Composite State/Choice and TO to the nearest following
 * one, in PlantUML output order -- searched only within the Transition's own
 * connected tree (`getRootBlock()`), never crossing into a separate,
 * unrelated top-level chain (02_design.md 24.13).
 *
 * A Transition that is still standalone (no previous and no next block at
 * all) is left untouched and stays eligible for a later connection --
 * unlike Message/Note (24.7a), Transition's FROM/TO dropdown already
 * defaults cleanly to `[*]` with no pre-existing bug to fix, so there's no
 * reason to search at all for a block that isn't actually connected to
 * anything yet.
 */
export function applyStateAutoDefault(_workspace: Blockly.Workspace, block: Blockly.Block): void {
  if (block.type !== "state_transition") return;
  if (block.getPreviousBlock() === null && block.getNextBlock() === null) return; // standalone; stay pending

  const ordered = flattenChain(block.getRootBlock(), stateNestedHeads);
  const index = ordered.indexOf(block);

  for (let i = index - 1; i >= 0; i--) {
    if (isNameable(ordered[i])) {
      setFieldValueRefreshingDropdown(block, "FROM", ordered[i].getFieldValue("NAME") as string);
      break;
    }
  }
  for (let i = index + 1; i < ordered.length; i++) {
    if (isNameable(ordered[i])) {
      setFieldValueRefreshingDropdown(block, "TO", ordered[i].getFieldValue("NAME") as string);
      break;
    }
  }
  consumeEligibility(block.id);
}
