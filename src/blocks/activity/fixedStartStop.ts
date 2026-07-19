import * as Blockly from "blockly/core";

/**
 * Places the single, fixed start/stop pair that every activity diagram
 * starts with.
 *
 * `stop` must stay movable (only `deletable: false`). Blockly's
 * connection_checker refuses to let a drag splice a block into a stack
 * position immediately before an immovable, non-shadow block (doDragChecks,
 * NEXT_STATEMENT case) -- with stop immovable, nothing could ever be dropped
 * directly before it via drag-and-drop. `start` has no previous connection,
 * so nothing ever needs to splice above it and it can safely stay immovable.
 */
export function setUpFixedStartStop(ws: Blockly.WorkspaceSvg): void {
  const startBlock = ws.newBlock("activity_start") as Blockly.BlockSvg;
  startBlock.initSvg();
  startBlock.render();
  startBlock.moveBy(40, 40);
  startBlock.setDeletable(false);
  startBlock.setMovable(false);

  const stopBlock = ws.newBlock("activity_stop") as Blockly.BlockSvg;
  stopBlock.initSvg();
  stopBlock.render();
  stopBlock.setDeletable(false);

  const startConnection = startBlock.nextConnection;
  const stopConnection = stopBlock.previousConnection;
  if (startConnection && stopConnection) {
    startConnection.connect(stopConnection);
  }
}
