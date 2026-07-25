import * as Blockly from "blockly/core";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";
import { consumeEligibility } from "../common/autoDefaultTracking";

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
 * Nearest preceding State/Composite State/Choice/Fork/Join name, in the same
 * connected chain as `block` -- never crossing into a Composite State's own
 * outer scope. `[*]` when nothing is found, or when the search reaches the
 * head of a Composite State's DO/REGION_i body: `getPreviousBlock()` returns
 * the enclosing Composite State itself in that case (its previousConnection
 * target is reached via the DO/REGION_i input, not a true previous sibling),
 * and `getSurroundParent()` confirms it (02_design.md 43.2 -- verified
 * against Blockly's own `block.ts` source, not assumed).
 */
function scanBackward(block: Blockly.Block): string {
  let cur: Blockly.Block = block;
  for (;;) {
    const prev = cur.getPreviousBlock();
    if (prev === null || prev === cur.getSurroundParent()) return "[*]";
    if (prev.type !== "state_transition") {
      return isNameable(prev) ? (prev.getFieldValue("NAME") as string) : "[*]";
    }
    cur = prev;
  }
}

/** Symmetric forward search. getNextBlock() never leaks into the parent (02_design.md 43.2), so no boundary check is needed here. */
function scanForward(block: Blockly.Block): string {
  let cur: Blockly.Block = block;
  for (;;) {
    const next = cur.getNextBlock();
    if (next === null) return "[*]";
    if (next.type !== "state_transition") {
      return isNameable(next) ? (next.getFieldValue("NAME") as string) : "[*]";
    }
    cur = next;
  }
}

/**
 * FR-STATE-11 (02_design.md 24.8, revised in 43): when a genuinely new
 * Transition makes its first *actual* connection (previous or next,
 * including into a Composite State's DO/REGION input), default FROM to the
 * name of the nearest preceding State/Composite State/Choice/Fork/Join and TO
 * to the nearest following one -- but when that nearest block is a Composite
 * State that this Transition is itself nested inside (first/last in its
 * DO/REGION_i body), use `[*]` instead of the Composite State's own name,
 * since that represents the Composite State's own internal start/end.
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

  setFieldValueRefreshingDropdown(block, "FROM", scanBackward(block));
  setFieldValueRefreshingDropdown(block, "TO", scanForward(block));
  consumeEligibility(block.id);
}
