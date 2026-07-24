import * as Blockly from "blockly/core";
import { INVALID_STATE_NAME_PATTERN } from "./blocks";

/** Block types + field names that hold a state name reference (FR-STATE-06). */
export const REFERENCE_FIELDS: Record<string, string[]> = {
  state_transition: ["FROM", "TO"],
};

/** Block types whose NAME is emitted as a bare PlantUML identifier (FR-STATE-13). */
const NAME_OWNER_TYPES = ["state_state", "state_choice", "state_composite"];

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
      ...workspace.getBlocksByType("state_choice", false),
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

  for (const blockType of NAME_OWNER_TYPES) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      const name = block.getFieldValue("NAME") as string;
      const message = INVALID_STATE_NAME_PATTERN.test(name)
        ? `The name "${name}" contains a space or a double quote, which breaks PlantUML's state-diagram syntax. Remove it.`
        : null;
      block.setWarningText(message);
      if (message) warnings.push({ blockId: block.id, message });
    }
  }

  return warnings;
}
