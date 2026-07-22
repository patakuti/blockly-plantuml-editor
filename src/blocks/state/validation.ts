import * as Blockly from "blockly/core";

/** Block types + field names that hold a state name reference (FR-STATE-06). */
export const REFERENCE_FIELDS: Record<string, string[]> = {
  state_transition: ["FROM", "TO"],
};

/** The pseudostate token is always a valid reference; it doesn't need a matching declaration. */
const PSEUDOSTATE = "[*]";

export interface StateWarning {
  blockId: string;
  message: string;
}

/**
 * Flags Transition blocks that reference a State/Composite State name no
 * longer declared anywhere in the workspace (FR-STATE-06, same pattern as
 * sequence/validation.ts's FR-SEQ-07 check). "[*]" is exempt since it's the
 * diagram's built-in start/end pseudostate, not a declared name.
 *
 * setWarningText() is a no-op on a headless (non-rendered) Block -- only
 * BlockSvg actually creates the warning icon -- so the found warnings are
 * also returned, letting tests assert on them without a rendered workspace.
 */
export function validateStateWorkspace(workspace: Blockly.Workspace): StateWarning[] {
  const warnings: StateWarning[] = [];
  const stateNames = new Set(
    [
      ...workspace.getBlocksByType("state_state", false),
      ...workspace.getBlocksByType("state_composite", false),
    ].map((b) => b.getFieldValue("NAME") as string),
  );

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      const missing = fields.filter(
        (field) => block.getFieldValue(field) !== PSEUDOSTATE && !stateNames.has(block.getFieldValue(field)),
      );
      const message =
        missing.length > 0
          ? `References a state that doesn't exist: ${missing
              .map((field) => `${field}="${block.getFieldValue(field)}"`)
              .join(", ")}`
          : null;
      block.setWarningText(message);
      if (message) warnings.push({ blockId: block.id, message });
    }
  }

  return warnings;
}
