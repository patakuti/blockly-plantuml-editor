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
 * Blocks that don't represent a state-like entity themselves and are
 * transparent to every "nearest state-like neighbor" search below -- the
 * search continues past them rather than stopping there. `state_transition`
 * was the only one originally (it's just a line between two states, not a
 * state itself); `state_description` was added in round 35 after a bug
 * report: a State Description sitting between a Transition and the State it
 * was searching for made the search stop at the description (not nameable)
 * and fall back to `[*]`/"" instead of reaching the State just past it. Same
 * reasoning applies to both Transition's own scanBackward/scanForward and
 * State Description's scanBackwardForDescription, so all three share this.
 */
function isTransparentStatement(block: Blockly.Block): boolean {
  return block.type === "state_transition" || block.type === "state_description";
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
    if (!isTransparentStatement(prev)) {
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
    if (!isTransparentStatement(next)) {
      return isNameable(next) ? (next.getFieldValue("NAME") as string) : "[*]";
    }
    cur = next;
  }
}

function isStateOrComposite(block: Blockly.Block): boolean {
  return block.type === "state_state" || block.type === "state_composite";
}

/**
 * Nearest preceding State/Composite State name, for State Description's
 * STATE auto-default. Unlike Transition's scanBackward(), Choice/Fork/Join
 * are *not* treated as the same category as State/Composite State here (per
 * user decision, round 34): hitting one stops the search immediately and
 * yields "" (unset) rather than being skipped over. Transition *and* other
 * State Description blocks are skipped over instead (round 35): a run of
 * State Description blocks stacked after the same State/Composite State (the
 * documented multi-line-description idiom, FR-STATE-18) must all resolve to
 * that same name, not stop at the first sibling description block. Same
 * Composite-boundary handling as scanBackward() (getSurroundParent(),
 * 02_design.md 43.2).
 */
function scanBackwardForDescription(block: Blockly.Block): string {
  let cur: Blockly.Block = block;
  for (;;) {
    const prev = cur.getPreviousBlock();
    if (prev === null || prev === cur.getSurroundParent()) return "";
    if (!isTransparentStatement(prev)) {
      return isStateOrComposite(prev) ? (prev.getFieldValue("NAME") as string) : "";
    }
    cur = prev;
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
  if (block.type === "state_transition") {
    if (block.getPreviousBlock() === null && block.getNextBlock() === null) return; // standalone; stay pending
    setFieldValueRefreshingDropdown(block, "FROM", scanBackward(block));
    setFieldValueRefreshingDropdown(block, "TO", scanForward(block));
    consumeEligibility(block.id);
    return;
  }

  if (block.type === "state_description") {
    applyDescriptionAutoDefault(block);
    return;
  }
}

/**
 * FR-STATE-19 (round 34): when a genuinely new State Description makes its
 * first *actual* connection, default STATE to the nearest preceding
 * State/Composite State -- or leave it unset ("") if there isn't one (no
 * previous block at all, the search reaches a Composite State's own
 * boundary, or the nearest preceding block is a Choice/Fork/Join). Unset is
 * surfaced as a block warning by validation.ts, same as any other missing
 * reference.
 *
 * Same "still standalone" carve-out as Transition above: a State Description
 * with no previous and no next block at all is left untouched and stays
 * eligible for a later connection.
 */
function applyDescriptionAutoDefault(block: Blockly.Block): void {
  if (block.getPreviousBlock() === null && block.getNextBlock() === null) return; // standalone; stay pending
  setFieldValueRefreshingDropdown(block, "STATE", scanBackwardForDescription(block));
  consumeEligibility(block.id);
}
