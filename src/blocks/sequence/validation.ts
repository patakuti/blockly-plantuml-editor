import * as Blockly from "blockly/core";

/** Block types + field names that hold a participant name reference (FR-SEQ-07). */
export const REFERENCE_FIELDS: Record<string, string[]> = {
  sequence_message: ["FROM", "TO"],
  sequence_note: ["TARGET"],
};

/** Block types that nest and count toward readability depth (FR-SEQ-09). */
const NESTING_BLOCK_TYPES = new Set(["sequence_alt", "sequence_opt", "sequence_loop"]);
const MAX_NESTING_DEPTH = 3;

export interface SequenceWarning {
  blockId: string;
  message: string;
}

/**
 * Re-validates the whole sequence workspace: flags message/note blocks that
 * reference a participant no longer declared (FR-SEQ-07), and flags
 * alt/opt/loop blocks nested deeper than a readability threshold (FR-SEQ-09).
 * Cheap enough to run on every non-UI change; no incremental diffing needed
 * at this workspace scale.
 *
 * setWarningText() is a no-op on a headless (non-rendered) Block -- only
 * BlockSvg actually creates the warning icon -- so the found warnings are
 * also returned, letting tests assert on them without a rendered workspace.
 */
export function validateSequenceWorkspace(workspace: Blockly.Workspace): SequenceWarning[] {
  const warnings: SequenceWarning[] = [];
  const participantNames = new Set(
    workspace.getBlocksByType("sequence_participant", false).map((b) => b.getFieldValue("NAME") as string),
  );

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      const missing = fields.filter((field) => !participantNames.has(block.getFieldValue(field)));
      const message =
        missing.length > 0
          ? `References a participant that doesn't exist: ${missing
              .map((field) => `${field}="${block.getFieldValue(field)}"`)
              .join(", ")}`
          : null;
      block.setWarningText(message);
      if (message) warnings.push({ blockId: block.id, message });
    }
  }

  for (const blockType of NESTING_BLOCK_TYPES) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      const depth = computeNestingDepth(block);
      const message =
        depth > MAX_NESTING_DEPTH
          ? `Nested ${depth} levels deep; consider flattening for readability.`
          : null;
      block.setWarningText(message);
      if (message) warnings.push({ blockId: block.id, message });
    }
  }

  return warnings;
}

function computeNestingDepth(block: Blockly.Block): number {
  let depth = 1;
  let current = block.getSurroundParent();
  while (current) {
    if (NESTING_BLOCK_TYPES.has(current.type)) depth++;
    current = current.getSurroundParent();
  }
  return depth;
}
