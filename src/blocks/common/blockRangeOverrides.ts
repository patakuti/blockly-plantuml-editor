import * as Blockly from "blockly/core";

/**
 * Blockly's built-in duplicate/delete actions only ever affect a single
 * block: `BlockSvg.toCopyData()` defaults `addNextBlocks` to `false`, and
 * `BlockSvg.checkAndDelete()` heals the stack (reconnecting the block above
 * to the block below) instead of removing the chain below it. Dragging, by
 * contrast, always carries the block plus everything connected to its
 * `next` connection and nested inputs.
 *
 * Every block in this app is a pure statement block (none has an
 * `outputConnection`), so re-pointing duplicate/delete at the same "self +
 * next-chain + nested children" range dragging already uses removes the
 * mismatch everywhere without per-block-type branching (01_requirements.md
 * FR-COM-09, 02_design.md 12.3).
 *
 * One deliberate exception: a non-deletable block (only `activity_stop`,
 * today) that shows up further down the chain is excluded from the swept-in
 * range. Dragging is allowed to carry it along -- that's an accepted,
 * non-destructive quirk (02_design.md 5.1.1) -- but duplicate/delete would
 * either destroy it or spawn an extra copy, both of which break the "exactly
 * one Stop" invariant (FR-ACT-01) in a way nothing can recover from short of
 * Undo. So the chain walk here stops one block short of the first
 * non-deletable block instead of blindly mirroring drag all the way down.
 */
export function installUnifiedBlockRangeOverrides(): void {
  overrideDuplicateContextMenuItem();
  overrideDeleteContextMenuItem();
  overrideDeleteShortcut();
}

function overrideDuplicateContextMenuItem(): void {
  const registry = Blockly.ContextMenuRegistry.registry;
  const existing = registry.getItem("blockDuplicate");
  if (!existing || existing.separator) return;
  registry.unregister("blockDuplicate");
  registry.register({
    ...existing,
    callback: (scope: Blockly.ContextMenuRegistry.Scope) => {
      if (scope.block) duplicateBlockAndChain(scope.block);
    },
  });
}

function overrideDeleteContextMenuItem(): void {
  const registry = Blockly.ContextMenuRegistry.registry;
  const existing = registry.getItem("blockDelete");
  if (!existing || existing.separator) return;
  registry.unregister("blockDelete");
  registry.register({
    ...existing,
    callback: (scope: Blockly.ContextMenuRegistry.Scope) => {
      if (scope.block) deleteBlockAndChain(scope.block);
    },
  });
}

function overrideDeleteShortcut(): void {
  const registry = Blockly.ShortcutRegistry.registry;
  const existing = registry.getRegistry()[Blockly.ShortcutItems.names.DELETE];
  if (!existing) return;
  registry.unregister(Blockly.ShortcutItems.names.DELETE);
  registry.register({
    ...existing,
    callback: (_workspace, e, _shortcut, scope) => {
      const block = scope.focusedNode;
      if (!(block instanceof Blockly.BlockSvg) || !block.isDeletable()) return false;
      if (e instanceof Event) e.preventDefault();
      deleteBlockAndChain(block);
      return true;
    },
  });
}

/** Duplicates `block` plus its next-chain and nested children, minus any non-deletable tail. */
function duplicateBlockAndChain(block: Blockly.BlockSvg): void {
  const copyData = block.toCopyData(/* addNextBlocks= */ true);
  if (!copyData) return;
  pruneNonDeletableTail(copyData.blockState);
  Blockly.clipboard.paste(copyData, block.workspace);
}

/** Deletes `block` plus its next-chain and nested children, minus any non-deletable tail. */
function deleteBlockAndChain(block: Blockly.BlockSvg): void {
  if (block.workspace.isFlyout) return;
  Blockly.Events.setGroup(true);
  try {
    block.workspace.hideChaff();
    const boundary = firstNonDeletableInChain(block);
    boundary?.unplug(/* healStack= */ false);
    block.dispose(/* healStack= */ false, /* animate= */ true);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

function firstNonDeletableInChain(block: Blockly.Block): Blockly.Block | null {
  let next = block.getNextBlock();
  while (next) {
    if (!next.isDeletable()) return next;
    next = next.getNextBlock();
  }
  return null;
}

/** Cuts off `state`'s `next` chain at the first block serialized with `deletable: false`. */
function pruneNonDeletableTail(state: Blockly.serialization.blocks.State): void {
  let node = state;
  while (node.next?.block) {
    if (node.next.block.deletable === false) {
      delete node.next;
      return;
    }
    node = node.next.block;
  }
}
