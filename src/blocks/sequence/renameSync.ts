import * as Blockly from "blockly/core";
import { REFERENCE_FIELDS } from "./validation";

/**
 * Keeps Message (FROM/TO) and Note (TARGET) fields in sync when a
 * sequence_participant's NAME changes (01_requirements.md FR-SEQ-13).
 * Unlike activity_swimlane's rename (renameSync.ts in blocks/activity),
 * participants are always renamed unconditionally -- no scope dialog -- since
 * a participant name is expected to identify a single block, not a group of
 * blocks sharing a name (02_design.md 17.2).
 */
export function syncParticipantRename(workspace: Blockly.Workspace, event: Blockly.Events.BlockChange): void {
  if (event.name !== "NAME" || !event.blockId) return;
  const block = workspace.getBlockById(event.blockId);
  if (!block || block.type !== "sequence_participant") return;

  const oldValue = event.oldValue as string;
  const newValue = event.newValue as string;
  if (oldValue === newValue) return;

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const referencingBlock of workspace.getBlocksByType(blockType, false)) {
      for (const field of fields) {
        if (referencingBlock.getFieldValue(field) === oldValue) {
          referencingBlock.setFieldValue(newValue, field);
        }
      }
    }
  }
}
