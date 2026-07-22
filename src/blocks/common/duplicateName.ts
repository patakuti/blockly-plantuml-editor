import * as Blockly from "blockly/core";

/**
 * Returns `desired` if it isn't in `existingNames`, otherwise the next free
 * name obtained by incrementing a trailing numeric suffix (or appending "2"
 * if there is none), skipping any candidate already in `existingNames`.
 */
export function nextAvailableName(existingNames: ReadonlySet<string>, desired: string): string {
  if (!existingNames.has(desired)) return desired;
  const match = desired.match(/^(.*?)(\d+)$/);
  const base = match ? match[1] : desired;
  let n = match ? parseInt(match[2], 10) + 1 : 2;
  while (existingNames.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/** NAME values currently used by blocks of `ownerTypes`, excluding `excludeBlockId` itself. */
function namesInUse(
  workspace: Blockly.Workspace,
  ownerTypes: ReadonlySet<string>,
  excludeBlockId?: string,
): Set<string> {
  const names = new Set<string>();
  for (const type of ownerTypes) {
    for (const block of workspace.getBlocksByType(type, false)) {
      if (block.id === excludeBlockId) continue;
      names.add(block.getFieldValue("NAME") as string);
    }
  }
  return names;
}

/**
 * Tracks a NAME value this module is about to force onto a block via its own
 * corrective `setFieldValue` call (reverting a rejected rename, or
 * auto-incrementing a newly created block's default name). Blockly's event
 * queue is asynchronous (`Blockly.Events.fire()` batches through
 * `setTimeout(0)`), so that corrective call's own BlockChange event arrives
 * at the listener as a separate, later invocation indistinguishable from an
 * ordinary user rename. Without this map, guardDuplicateRename would let it
 * fall through to onFieldChange/rename-sync and retarget every reference to
 * the *previous* (rejected, or default) name onto this block -- silently
 * corrupting unrelated, pre-existing references (confirmed live: rejecting a
 * rename to an in-use name was cascading the revert's own echo event onto
 * the name's real owner's Transitions). Recording the expected value here
 * lets the listener recognize and silently swallow that specific echo.
 */
const pendingCorrections = new WeakMap<Blockly.Block, string>();

function setNameSilently(block: Blockly.Block, value: string): void {
  pendingCorrections.set(block, value);
  block.setFieldValue(value, "NAME");
}

/**
 * Rejects a NAME edit that would collide with another block of the same
 * owner-type group (Participant, or State/Composite State/Choice together),
 * reverting the field to its previous value. Also recognizes and swallows
 * the echo BlockChange event produced by this module's own corrective
 * writes (see `pendingCorrections`). Returns true when the event should not
 * be propagated any further (caller should skip rename-sync for it) --
 * either because it was just reverted, or because it's a corrective echo
 * that never represented a real rename.
 */
export function guardDuplicateRename(
  workspace: Blockly.Workspace,
  event: Blockly.Events.BlockChange,
  ownerTypes: ReadonlySet<string>,
): boolean {
  if (event.name !== "NAME" || !event.blockId) return false;
  const block = workspace.getBlockById(event.blockId);
  if (!block || !ownerTypes.has(block.type)) return false;

  if (pendingCorrections.get(block) === event.newValue) {
    pendingCorrections.delete(block);
    return true;
  }

  const oldValue = event.oldValue as string;
  const newValue = event.newValue as string;
  if (oldValue === newValue) return false;

  if (namesInUse(workspace, ownerTypes, block.id).has(newValue)) {
    setNameSilently(block, oldValue);
    return true;
  }
  return false;
}

/**
 * After new blocks are created (toolbox drag, paste, the "Duplicate" context
 * menu item, or PlantUML import), auto-renames any owner-type block whose
 * NAME collides with another existing block by appending/incrementing a
 * numeric suffix until it's unique. Processes `event.ids` in order so a batch
 * that introduces several colliding names at once (e.g. duplicating a
 * Composite State together with its nested children) resolves each one
 * against both pre-existing blocks and any already-renamed sibling from the
 * same batch. The rename itself never propagates to rename-sync (see
 * `setNameSilently`/`guardDuplicateRename`): a newly created block's default
 * or copied name never had a legitimate reference pointing at it yet, so
 * there's nothing valid to redirect, only a risk of corrupting an unrelated
 * pre-existing reference that happened to match.
 */
export function resolveDuplicateNamesOnCreate(
  workspace: Blockly.Workspace,
  event: Blockly.Events.BlockCreate,
  ownerTypes: ReadonlySet<string>,
): void {
  for (const id of event.ids ?? []) {
    const block = workspace.getBlockById(id);
    if (!block || !ownerTypes.has(block.type)) continue;

    const existing = namesInUse(workspace, ownerTypes, block.id);
    const current = block.getFieldValue("NAME") as string;
    if (existing.has(current)) {
      setNameSilently(block, nextAvailableName(existing, current));
    }
  }
}
