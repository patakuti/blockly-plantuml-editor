import * as Blockly from "blockly/core";

/**
 * `stop` must stay movable (only `deletable: false`). Blockly's
 * connection_checker refuses to let a drag splice a block into a stack
 * position immediately before an immovable, non-shadow block (doDragChecks,
 * NEXT_STATEMENT case) -- with stop immovable, nothing could ever be dropped
 * directly before it via drag-and-drop. `start` has no previous connection,
 * so nothing ever needs to splice above it and it can safely stay immovable.
 *
 * These flags are also part of a block's serialized state, so a workspace
 * saved before this was fixed -- or a hand-edited JSON import -- can bring
 * back an immovable stop on restore. enforceFixedStartStopInvariants() is
 * called from main.ts's onValidate wiring on every load/change so a stale
 * save can't reintroduce the bug.
 */
export function enforceFixedStartStopInvariants(ws: Blockly.Workspace): void {
  for (const startBlock of ws.getBlocksByType("activity_start", false)) {
    startBlock.setDeletable(false);
    startBlock.setMovable(false);
  }
  for (const stopBlock of ws.getBlocksByType("activity_stop", false)) {
    stopBlock.setDeletable(false);
    stopBlock.setMovable(true);
  }
}

/** Places the single, fixed start/stop pair that every activity diagram starts with. */
export function setUpFixedStartStop(ws: Blockly.WorkspaceSvg): void {
  const startBlock = ws.newBlock("activity_start") as Blockly.BlockSvg;
  startBlock.initSvg();
  startBlock.render();
  startBlock.moveBy(40, 40);

  const stopBlock = ws.newBlock("activity_stop") as Blockly.BlockSvg;
  stopBlock.initSvg();
  stopBlock.render();

  enforceFixedStartStopInvariants(ws);

  const startConnection = startBlock.nextConnection;
  const stopConnection = stopBlock.previousConnection;
  if (startConnection && stopConnection) {
    startConnection.connect(stopConnection);
  }
}
