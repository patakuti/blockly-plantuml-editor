import * as Blockly from "blockly/core";
import { openRenameScopeDialog } from "../../ui/renameScopeDialog";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";

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
 * Repoints activity_start's SWIMLANE pin (FR-ACT-11) from oldValue to
 * newValue wherever it's still set to oldValue. Whether this needs to run is
 * decided by the caller based on whether any activity_swimlane block is
 * still named oldValue afterwards -- if none are, oldValue no longer
 * identifies a lane at all, so a pin left pointing at it would otherwise go
 * stale (02_design.md 17.3).
 */
function propagateStartPin(workspace: Blockly.Workspace, oldValue: string, newValue: string): void {
  for (const start of workspace.getBlocksByType("activity_start", false)) {
    if (start.getFieldValue("SWIMLANE") === oldValue) {
      setFieldValueRefreshingDropdown(start, "SWIMLANE", newValue);
    }
  }
}

/**
 * When an activity_swimlane's NAME changes, keeps activity_start's SWIMLANE
 * pin (FR-ACT-11) from going stale, and -- when other swimlane blocks still
 * carry the old name -- asks the user (01_requirements.md FR-ACT-13) whether
 * to rename just this block (already done -- no-op) or every block sharing
 * the old name.
 *
 * The Start pin only needs repointing once oldValue stops identifying any
 * lane: immediately, when this was the only block with that name (no
 * dialog -- nothing to disambiguate), or after an "all" choice once the
 * others are renamed too. Picking "this" (or dismissing the dialog) leaves
 * oldValue in place on the remaining blocks, so the pin is still valid and
 * is left untouched.
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

  if (others.length === 0) {
    propagateStartPin(workspace, oldValue, newValue);
    return;
  }

  openRenameScopeDialog({ oldName: oldValue, newName: newValue, otherCount: others.length }).then((scope) => {
    if (scope !== "all") return;
    applying = true;
    try {
      for (const b of others) b.setFieldValue(newValue, "NAME");
      propagateStartPin(workspace, oldValue, newValue);
    } finally {
      applying = false;
    }
  });
}
