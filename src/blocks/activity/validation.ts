import * as Blockly from "blockly/core";

export interface ActivityWarning {
  blockId: string;
  message: string;
}

/**
 * Re-validates the whole activity workspace:
 * - flags every `activity_start` block with a warning when more than one
 *   exists (FR-ACT-01 allows at most one). This only warns -- it does not
 *   block code generation, which always picks a single chain to output (see
 *   activityWorkspaceToCode).
 * - flags a start block whose SWIMLANE field (02_design.md 14.5) references
 *   a swimlane name that no longer has a matching `activity_swimlane` block
 *   (renamed/deleted after being picked), the same "stale reference" pattern
 *   as sequence/validation.ts's REFERENCE_FIELDS check.
 */
export function validateActivityWorkspace(workspace: Blockly.Workspace): ActivityWarning[] {
  const warnings: ActivityWarning[] = [];
  const startBlocks = workspace.getBlocksByType("activity_start", false);
  const swimlaneNames = new Set(
    workspace.getBlocksByType("activity_swimlane", false).map((b) => b.getFieldValue("NAME") as string),
  );

  const duplicateMessage =
    startBlocks.length > 1 ? `Only one start block is allowed; found ${startBlocks.length}.` : null;

  for (const block of startBlocks) {
    const issues: string[] = [];
    if (duplicateMessage) issues.push(duplicateMessage);

    const swimlane = block.getFieldValue("SWIMLANE") as string;
    if (swimlane && !swimlaneNames.has(swimlane)) {
      issues.push(`References a swimlane that doesn't exist: SWIMLANE="${swimlane}"`);
    }

    const message = issues.length > 0 ? issues.join("\n") : null;
    block.setWarningText(message);
    if (message) warnings.push({ blockId: block.id, message });
  }

  return warnings;
}
