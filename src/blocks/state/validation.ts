import * as Blockly from "blockly/core";
import { INVALID_STATE_NAME_PATTERN } from "./blocks";

/** Block types + field names that hold a state name reference (FR-STATE-06/FR-STATE-20). */
export const REFERENCE_FIELDS: Record<string, string[]> = {
  state_transition: ["FROM", "TO"],
  state_description: ["STATE"],
};

/** Block types whose NAME is emitted as a bare PlantUML identifier (FR-STATE-13). */
const NAME_OWNER_TYPES = ["state_state", "state_choice", "state_composite", "state_fork", "state_join"];

/** The pseudostate token is always a valid reference; it doesn't need a matching declaration. */
const PSEUDOSTATE = "[*]";

/**
 * Shallow/deep history pseudostate tokens (FR-STATE-16, 02_design.md 38.3).
 * Bare, they're always valid (same as PSEUDOSTATE). Suffixed onto a name
 * (e.g. "Foo[H]"), they're only valid if "Foo" is a currently declared
 * Composite State -- History has no meaning for a plain State/Choice/Fork/Join.
 */
const SHALLOW_HISTORY = "[H]";
const DEEP_HISTORY = "[H*]";
const HISTORY_REFERENCE = /^(.+)\[H\*?\]$/;

/**
 * State Description's STATE field (FR-STATE-19/20) doesn't accept the
 * pseudostate marker or history tokens -- PlantUML's "<name> : text" syntax
 * describes a declared state, not a pseudostate -- so it's excluded via
 * allowPseudostate=false, unlike Transition's FROM/TO.
 */
function isValidReference(
  value: string,
  stateNames: ReadonlySet<string>,
  compositeNames: ReadonlySet<string>,
  allowPseudostate: boolean,
): boolean {
  if (!allowPseudostate) return stateNames.has(value);
  if (value === PSEUDOSTATE || value === SHALLOW_HISTORY || value === DEEP_HISTORY) return true;
  const historyMatch = HISTORY_REFERENCE.exec(value);
  if (historyMatch) return compositeNames.has(historyMatch[1]);
  return stateNames.has(value);
}

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
  const compositeNames = new Set(
    workspace.getBlocksByType("state_composite", false).map((b) => b.getFieldValue("NAME") as string),
  );
  const stateNames = new Set(
    [
      ...workspace.getBlocksByType("state_state", false),
      ...workspace.getBlocksByType("state_composite", false),
      ...workspace.getBlocksByType("state_choice", false),
      ...workspace.getBlocksByType("state_fork", false),
      ...workspace.getBlocksByType("state_join", false),
    ].map((b) => b.getFieldValue("NAME") as string),
  );

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    const allowPseudostate = blockType !== "state_description";
    for (const block of workspace.getBlocksByType(blockType, false)) {
      const missing = fields.filter(
        (field) => !isValidReference(block.getFieldValue(field), stateNames, compositeNames, allowPseudostate),
      );
      const message =
        missing.length > 0
          ? blockType === "state_description" && block.getFieldValue("STATE") === ""
            ? "Not attached to any state. Connect it directly after a State/Composite State block, or pick one manually."
            : `References a state that doesn't exist: ${missing
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
