import type * as Blockly from "blockly/core";

/**
 * Every block ID ever observed via a BlockCreate event this session, plus any
 * ID pre-registered through registerIneligible before its BlockCreate event
 * was even delivered (Blockly's event queue is asynchronous, see
 * 02_design.md 24.1/24.3, matching the pendingCorrections precedent in
 * duplicateName.ts). A BlockCreate event carrying an ID already in this set
 * is never eligible for auto-default: either it's a deliberate exclusion
 * (Duplicate, workspace restore, PlantUML import -- all of which already
 * carry meaningful field values that must not be overwritten), or it's
 * Undo/Redo recreating a block under its original ID, which Blockly does not
 * give us a call site to intercept directly.
 */
const knownBlockIds = new Set<string>();

/** IDs that are eligible for auto-default and haven't had their first connection consumed yet. */
const eligibleForAutoDefault = new Set<string>();

/**
 * Marks `ids` as already known, so a later BlockCreate for any of them is
 * never treated as a blank, freshly-dropped block. Call synchronously right
 * after creating blocks whose field values are already meaningful (Duplicate,
 * workspace restore, PlantUML import) -- see 02_design.md 24.4 for the exact
 * call sites.
 */
export function registerIneligible(ids: Iterable<string>): void {
  for (const id of ids) knownBlockIds.add(id);
}

/**
 * Call from the workspace's BlockCreate handler for every diagram type
 * (02_design.md 24.5). Only IDs never seen before -- neither via a prior
 * BlockCreate nor via registerIneligible -- become eligible.
 */
export function trackBlockCreate(event: Blockly.Events.BlockCreate): void {
  for (const id of event.ids ?? []) {
    if (knownBlockIds.has(id)) continue;
    knownBlockIds.add(id);
    eligibleForAutoDefault.add(id);
  }
}

/**
 * Whether `blockId` is still eligible (never had a definitive default
 * applied). Peeking rather than consuming lets a diagram-specific
 * autoDefaultOnConnect callback decide for itself whether this particular
 * BlockMove actually settled on a value -- e.g. a Message dropped standalone
 * while other Messages already exist elsewhere in the workspace has nothing
 * to search yet, so it should stay eligible for a later move that actually
 * connects it to the real chain (02_design.md 24.7a).
 */
export function isEligible(blockId: string): boolean {
  return eligibleForAutoDefault.has(blockId);
}

/**
 * Consumes `blockId`'s eligibility. Call only once a diagram-specific
 * autoDefaultOnConnect callback has actually applied a definitive default (or
 * confirmed there's nothing to default to), so a later reconnect of the same
 * block never re-triggers it.
 */
export function consumeEligibility(blockId: string): void {
  eligibleForAutoDefault.delete(blockId);
}

/**
 * Forgets `ids` entirely, as if their blocks had never been seen.
 *
 * Called generically from `main.ts`'s shared change listener on every
 * `Blockly.Events.BlockDelete` (`event.ids`, which -- like `BlockCreate`'s --
 * covers the whole deleted block-plus-descendants range in one event,
 * 02_design.md 26.3c), rather than from each individual deletion code path.
 * This covers every way a block can be removed -- the right-click/keyboard
 * delete (`deleteBlockAndChain` below), dragging a block onto the toolbox
 * (Blockly's own built-in delete-by-drag gesture, which never went through
 * `deleteBlockAndChain` at all), and every `workspace.clear()` call site
 * (the toolbar's Clear button, JSON import, PlantUML import for all three
 * diagram types) -- with a single mechanism instead of needing a matching
 * call at each one (02_design.md 24.11/26.3b's per-call-site approach missed
 * the drag-to-toolbox gesture entirely).
 *
 * Confirmed live in the browser: deleting a block and then dragging a new
 * one out of the *same* toolbox flyout slot can hand the new block the
 * exact same ID the just-deleted one had (Blockly reuses the flyout
 * template's serialized ID when it's free in the target workspace). Without
 * this, that freed ID would still be sitting in knownBlockIds from the
 * deleted block, so the new block's BlockCreate would be misread as
 * Undo/Redo restoring the old one and get excluded from auto-default --
 * silently reproducing the FR-SEQ-15 empty-FROM/TO bug (24.7a) for every
 * "delete a Message, drag a fresh one from the same slot" sequence, which is
 * common, ordinary usage (not a rare edge case).
 *
 * Trade-off accepted: genuinely Undo-ing this exact delete now also counts
 * as "unseen", so if Undo reconnects the restored block as part of the same
 * operation (02_design.md 24.1: undoing a mid-chain delete fires reconnect
 * BlockMove events), auto-default may run on it and override its correctly
 * restored FROM/TO/TARGET with a fresh guess. Deliberately chosen over the
 * alternative: that regression is rare and immediately visible/correctable,
 * whereas leaving it unforgotten broke the far more common delete-and-redrag
 * pattern outright (02_design.md 24.11).
 */
export function forgetBlocks(ids: Iterable<string>): void {
  for (const id of ids) {
    knownBlockIds.delete(id);
    eligibleForAutoDefault.delete(id);
  }
}
