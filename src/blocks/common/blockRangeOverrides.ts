import * as Blockly from "blockly/core";
import { registerIneligible } from "./autoDefaultTracking";

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

/**
 * Duplicates `block` plus its next-chain and nested children. The pasted
 * blocks already carry the source's field values (FROM/TO/TARGET included),
 * so they're excluded from Round 14's auto-default (02_design.md 24.4): left
 * untracked, a later manual reconnect would treat them as freshly-dropped
 * blank blocks and overwrite the values this duplicate is meant to preserve.
 */
function duplicateBlockAndChain(block: Blockly.BlockSvg): void {
  const copyData = block.toCopyData(/* addNextBlocks= */ true);
  if (!copyData) return;
  const pasted = Blockly.clipboard.paste(copyData, block.workspace) as Blockly.BlockSvg | null;
  if (pasted) registerIneligible(pasted.getDescendants(false).map((b) => b.id));
}

/**
 * Deletes `block` plus its next-chain and nested children. The resulting
 * `Blockly.Events.BlockDelete` is handled generically by `main.ts` (forgets
 * the deleted IDs from Round 14's auto-default tracking, 02_design.md
 * 24.11/26.3c): confirmed live that dragging a fresh block out of the same
 * toolbox flyout slot right after this can hand it the exact same ID the
 * just-deleted block had, which must be treated as a genuinely new block, not
 * as Undo/Redo restoring the old one.
 */
function deleteBlockAndChain(block: Blockly.BlockSvg): void {
  if (block.workspace.isFlyout) return;
  Blockly.Events.setGroup(true);
  try {
    block.workspace.hideChaff();
    block.dispose(/* healStack= */ false, /* animate= */ true);
  } finally {
    Blockly.Events.setGroup(false);
  }
}
