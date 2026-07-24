import * as Blockly from "blockly/core";
import { REFERENCE_FIELDS } from "./validation";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";

const NAME_OWNER_TYPES = new Set(["component_component"]);

export function syncComponentRename(workspace: Blockly.Workspace, event: Blockly.Events.BlockChange): void {
  if (event.name !== "NAME" || !event.blockId) return;
  const block = workspace.getBlockById(event.blockId);
  if (!block || !NAME_OWNER_TYPES.has(block.type)) return;

  const oldValue = event.oldValue as string;
  const newValue = event.newValue as string;
  if (oldValue === newValue) return;

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const referencingBlock of workspace.getBlocksByType(blockType, false)) {
      for (const field of fields) {
        if (referencingBlock.getFieldValue(field) === oldValue) {
          setFieldValueRefreshingDropdown(referencingBlock, field, newValue);
        }
      }
    }
  }
}
