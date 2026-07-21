import * as Blockly from "blockly/core";
import { openRenameScopeDialog } from "../../ui/renameScopeDialog";

/**
 * Reentrancy guard for the "all" branch below: applying the batch rename
 * calls setFieldValue on other blocks, which re-fires this same handler for
 * each of them. By the time those re-entrant calls run, every block that
 * shared the old name has already been renamed (the loop below runs to
 * completion before Blockly's queued change events are delivered), so
 * `others` would already come back empty and this flag is only a defensive
 * backstop against relying on that ordering (02_design.md 17.3).
 */
let applying = false;

/**
 * When an activity_swimlane's NAME changes and other swimlane blocks still
 * carry the old name, asks the user (01_requirements.md FR-ACT-13) whether
 * to rename just this block (already done -- no-op) or every block sharing
 * the old name, propagating to activity_start's SWIMLANE pin (FR-ACT-11) too
 * in the "all" case. Skips the dialog entirely when no other block shares
 * the old name, since there's nothing to disambiguate.
 */
export function syncSwimlaneRename(workspace: Blockly.Workspace, event: Blockly.Events.BlockChange): void {
  if (applying || event.name !== "NAME" || !event.blockId) return;
  const block = workspace.getBlockById(event.blockId);
  if (!block || block.type !== "activity_swimlane") return;

  const oldValue = event.oldValue as string;
  const newValue = event.newValue as string;
  if (oldValue === newValue) return;

  const others = workspace
    .getBlocksByType("activity_swimlane", false)
    .filter((b) => b.id !== block.id && b.getFieldValue("NAME") === oldValue);
  if (others.length === 0) return;

  openRenameScopeDialog({ oldName: oldValue, newName: newValue, otherCount: others.length }).then((scope) => {
    if (scope !== "all") return;
    applying = true;
    try {
      for (const b of others) b.setFieldValue(newValue, "NAME");
      for (const start of workspace.getBlocksByType("activity_start", false)) {
        if (start.getFieldValue("SWIMLANE") === oldValue) start.setFieldValue(newValue, "SWIMLANE");
      }
    } finally {
      applying = false;
    }
  });
}
