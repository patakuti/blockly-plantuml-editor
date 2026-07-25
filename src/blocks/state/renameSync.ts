import * as Blockly from "blockly/core";
import { REFERENCE_FIELDS } from "./validation";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";

const NAME_OWNER_TYPES = new Set(["state_state", "state_composite", "state_choice", "state_fork", "state_join"]);

/** Shallow/deep history suffixes (FR-STATE-16, 02_design.md 38.3): "Foo[H]"/"Foo[H*]" track a rename of "Foo" the same way a bare reference does. */
const SHALLOW_HISTORY = "[H]";
const DEEP_HISTORY = "[H*]";

/**
 * Keeps Transition (FROM/TO) fields in sync when a state_state's,
 * state_composite's, or state_choice's NAME changes (01_requirements.md
 * FR-STATE-07, extended to state_choice in Round 12). Same
 * unconditional, dialog-free pattern as sequence/renameSync.ts's
 * syncParticipantRename (02_design.md 21.1): state names, like participant
 * names, are expected to identify a single block rather than a group of
 * blocks sharing a name, unlike activity_swimlane's rename.
 */
export function syncStateRename(workspace: Blockly.Workspace, event: Blockly.Events.BlockChange): void {
  if (event.name !== "NAME" || !event.blockId) return;
  const block = workspace.getBlockById(event.blockId);
  if (!block || !NAME_OWNER_TYPES.has(block.type)) return;

  const oldValue = event.oldValue as string;
  const newValue = event.newValue as string;
  if (oldValue === newValue) return;

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const referencingBlock of workspace.getBlocksByType(blockType, false)) {
      for (const field of fields) {
        const current = referencingBlock.getFieldValue(field);
        if (current === oldValue) {
          setFieldValueRefreshingDropdown(referencingBlock, field, newValue);
        } else if (current === `${oldValue}${SHALLOW_HISTORY}`) {
          setFieldValueRefreshingDropdown(referencingBlock, field, `${newValue}${SHALLOW_HISTORY}`);
        } else if (current === `${oldValue}${DEEP_HISTORY}`) {
          setFieldValueRefreshingDropdown(referencingBlock, field, `${newValue}${DEEP_HISTORY}`);
        }
      }
    }
  }
}
