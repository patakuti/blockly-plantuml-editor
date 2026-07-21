import * as Blockly from "blockly/core";
import { getNoteDirection, setNoteDirection } from "../../generators/common/noteWrapper";

const MENU_ITEM_ID = "blockCommentNoteDirection";

/**
 * Adds a right-click menu item (only shown on blocks that have a comment
 * attached) letting the user flip the PlantUML note direction between
 * "right" (default) and "left" (01_requirements.md FR-COM-12).
 *
 * The direction itself lives in `Block.data`, Blockly's standard free-form
 * per-block string that already round-trips through
 * `Blockly.serialization.blocks` save/load. Toggling it doesn't go through
 * any Blockly API that fires a change event on its own, so a `BlockChange`
 * event is fired manually -- `main.ts`'s change listener only checks
 * `event.isUiEvent` (false for `BlockChange`) before re-generating the
 * preview and autosaving, so this is enough to pick up the change without
 * touching main.ts.
 */
export function installNoteDirectionMenu(): void {
  Blockly.ContextMenuRegistry.registry.register({
    id: MENU_ITEM_ID,
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: 2.5,
    preconditionFn: (scope) => (scope.block?.getCommentText() ? "enabled" : "hidden"),
    displayText: (scope) => {
      const direction = getNoteDirection(scope.block!);
      const next = direction === "right" ? "Left" : "Right";
      const current = direction === "right" ? "Right" : "Left";
      return `Note direction: ${current} (click for ${next})`;
    },
    callback: (scope) => {
      const block = scope.block;
      if (!block) return;
      const oldValue = block.data;
      const nextDirection = getNoteDirection(block) === "right" ? "left" : "right";
      setNoteDirection(block, nextDirection);
      Blockly.Events.fire(new Blockly.Events.BlockChange(block, "data", null, oldValue, block.data));
    },
  });
}
