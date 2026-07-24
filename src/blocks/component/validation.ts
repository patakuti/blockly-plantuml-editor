import * as Blockly from "blockly/core";

/** Block types + field names that hold a component name reference (FR-COMP-05). */
export const REFERENCE_FIELDS: Record<string, string[]> = {
  component_dependency: ["FROM", "TO"],
};

export interface ComponentWarning {
  blockId: string;
  message: string;
}

/**
 * Flags Dependency blocks that reference a Component name no longer declared
 * anywhere in the workspace (FR-COMP-05, same pattern as
 * sequence/validation.ts's FR-SEQ-07 / state/validation.ts's FR-STATE-06).
 *
 * setWarningText() is a no-op on a headless (non-rendered) Block -- only
 * BlockSvg actually creates the warning icon -- so the found warnings are
 * also returned, letting tests assert on them without a rendered workspace.
 */
export function validateComponentWorkspace(workspace: Blockly.Workspace): ComponentWarning[] {
  const warnings: ComponentWarning[] = [];
  const componentNames = new Set(
    workspace.getBlocksByType("component_component", false).map((b) => b.getFieldValue("NAME") as string),
  );

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      const missing = fields.filter((field) => !componentNames.has(block.getFieldValue(field)));
      const message =
        missing.length > 0
          ? `References a component that doesn't exist: ${missing
              .map((field) => `${field}="${block.getFieldValue(field)}"`)
              .join(", ")}`
          : null;
      block.setWarningText(message);
      if (message) warnings.push({ blockId: block.id, message });
    }
  }

  return warnings;
}
