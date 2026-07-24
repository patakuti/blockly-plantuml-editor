import * as Blockly from "blockly/core";
import { PARTICIPANT_LIKE_TYPES } from "./constants";
import { pickSequenceMessageChainHead } from "../../generators/sequenceGenerator";
import { flattenChain } from "../common/statementOrder";

/** Block types + field names that hold a participant name reference (FR-SEQ-07). */
export const REFERENCE_FIELDS: Record<string, string[]> = {
  sequence_message: ["FROM", "TO"],
  sequence_note: ["TARGET"],
  sequence_activate: ["TARGET"],
  sequence_deactivate: ["TARGET"],
};

/** Block types that nest and count toward readability depth (FR-SEQ-09). */
const NESTING_BLOCK_TYPES = new Set(["sequence_alt", "sequence_opt", "sequence_loop"]);
const MAX_NESTING_DEPTH = 3;

export interface SequenceWarning {
  blockId: string;
  message: string;
}

/**
 * Re-validates the whole sequence workspace: flags message/note/activate/
 * deactivate blocks that reference a participant no longer declared
 * (FR-SEQ-07), flags alt/opt/loop blocks nested deeper than a readability
 * threshold (FR-SEQ-09), flags activate/deactivate blocks whose pairing is
 * broken (FR-SEQ-20), and flags any non-Participant/Actor block that falls
 * outside the single message chain sequenceWorkspaceToCode actually
 * generates from (FR-SEQ-21, generalized from activity/validation.ts's
 * FR-ACT-17 -- Participant/Actor are exempt since 4.6章 guarantees every
 * declaration chain gets concatenated, never dropped). Cheap enough to run
 * on every non-UI change; no incremental diffing needed at this workspace
 * scale.
 *
 * sequence_activate/sequence_deactivate can be checked by more than one
 * category (reference + pairing + reachability), so messages are
 * accumulated per block ID and setWarningText() is called once per block at
 * the end -- calling it separately from each category would let the later
 * call silently discard the earlier one (02_design.md 33.4).
 *
 * setWarningText() is a no-op on a headless (non-rendered) Block -- only
 * BlockSvg actually creates the warning icon -- so the found warnings are
 * also returned, letting tests assert on them without a rendered workspace.
 */
export function validateSequenceWorkspace(workspace: Blockly.Workspace): SequenceWarning[] {
  const messages = new Map<string, string[]>();
  const blocksById = new Map<string, Blockly.Block>();
  const addMessage = (block: Blockly.Block, message: string) => {
    blocksById.set(block.id, block);
    messages.set(block.id, [...(messages.get(block.id) ?? []), message]);
  };

  const participantNames = new Set(
    PARTICIPANT_LIKE_TYPES.flatMap((type) => workspace.getBlocksByType(type, false)).map(
      (b) => b.getFieldValue("NAME") as string,
    ),
  );

  for (const [blockType, fields] of Object.entries(REFERENCE_FIELDS)) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      blocksById.set(block.id, block);
      const missing = fields.filter((field) => !participantNames.has(block.getFieldValue(field)));
      if (missing.length > 0) {
        addMessage(
          block,
          `References a participant that doesn't exist: ${missing
            .map((field) => `${field}="${block.getFieldValue(field)}"`)
            .join(", ")}`,
        );
      }
    }
  }

  for (const blockType of NESTING_BLOCK_TYPES) {
    for (const block of workspace.getBlocksByType(blockType, false)) {
      blocksById.set(block.id, block);
      const depth = computeNestingDepth(block);
      if (depth > MAX_NESTING_DEPTH) {
        addMessage(block, `Nested ${depth} levels deep; consider flattening for readability.`);
      }
    }
  }

  checkActivationPairing(workspace, addMessage);

  // FR-SEQ-21: uses the shared flattenChain (not walkInGenerationOrder below) because this
  // check is about topological connectivity -- "is this block connected into the chain at
  // all" -- regardless of whether it's individually disabled, matching activity/validation.ts's
  // FR-ACT-17 precedent. walkInGenerationOrder's disabled-skipping is a different, narrower
  // concern specific to activation pairing (a disabled activate never actually emits code, so
  // it must not count as opening an activation); the two aren't interchangeable.
  const reachable = new Set(
    flattenChain(pickSequenceMessageChainHead(workspace), sequenceNestedHeads).map((b) => b.id),
  );
  for (const block of workspace.getAllBlocks(false)) {
    if ((PARTICIPANT_LIKE_TYPES as readonly string[]).includes(block.type)) continue; // never dropped, 4.6章
    blocksById.set(block.id, block);
    if (!reachable.has(block.id)) {
      addMessage(block, "This block isn't part of the diagram's output chain, so it won't appear in the generated PlantUML.");
    }
  }

  const warnings: SequenceWarning[] = [];
  for (const [blockId, block] of blocksById) {
    const combined = messages.get(blockId)?.join("\n") ?? null;
    block.setWarningText(combined);
    if (combined) warnings.push({ blockId, message: combined });
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

/** alt/opt/loop bodies, in the order sequenceGenerator's forBlock implementations emit them. */
function sequenceNestedHeads(block: Blockly.Block): (Blockly.Block | null)[] {
  switch (block.type) {
    case "sequence_alt": {
      const heads = [block.getInputTargetBlock("DO0")];
      for (let i = 1; block.getInput(`ELSE_LABEL_${i}`); i++) {
        heads.push(block.getInputTargetBlock(`ELSE_BODY_${i}`));
      }
      return heads;
    }
    case "sequence_opt":
    case "sequence_loop":
      return [block.getInputTargetBlock("DO")];
    default:
      return [];
  }
}

/**
 * Visits blocks in the exact order sequenceGenerator would emit them into the
 * PlantUML text: alt/opt/loop bodies are visited in place (in source order),
 * matching the fact that PlantUML processes activate/deactivate sequentially
 * regardless of which branch they're nested in (02_design.md 33.1, verified
 * against a local PlantUML render). Disabled blocks are skipped entirely,
 * including their nested bodies, since generateStatements never calls into
 * them either.
 */
function walkInGenerationOrder(firstBlock: Blockly.Block | null, visit: (block: Blockly.Block) => void): void {
  let block = firstBlock;
  while (block) {
    if (block.isEnabled()) {
      visit(block);
      for (const nested of sequenceNestedHeads(block)) {
        walkInGenerationOrder(nested, visit);
      }
    }
    block = block.getNextBlock();
  }
}

/**
 * Flags activate/deactivate blocks whose pairing is broken (FR-SEQ-20): a
 * deactivate with no preceding unmatched activate for the same participant,
 * or an activate never followed by a matching deactivate. Multiple activates
 * for the same participant pair LIFO (innermost closes first).
 *
 * Only walks the message chain that's actually generated
 * (pickSequenceMessageChainHead) -- a disconnected extra chain is already
 * excluded from the generated PlantUML (known limitation, see
 * sequenceWorkspaceToCode), so its activate/deactivate blocks aren't part of
 * what's actually rendered and are intentionally left out of this check too
 * (02_design.md 33.6).
 */
function checkActivationPairing(
  workspace: Blockly.Workspace,
  addMessage: (block: Blockly.Block, message: string) => void,
): void {
  const openStack = new Map<string, Blockly.Block[]>();
  walkInGenerationOrder(pickSequenceMessageChainHead(workspace), (block) => {
    if (block.type === "sequence_activate") {
      const target = block.getFieldValue("TARGET") as string;
      const stack = openStack.get(target) ?? [];
      stack.push(block);
      openStack.set(target, stack);
    } else if (block.type === "sequence_deactivate") {
      const target = block.getFieldValue("TARGET") as string;
      const stack = openStack.get(target) ?? [];
      if (stack.length > 0) {
        stack.pop();
      } else {
        addMessage(block, `Deactivates "${target}" but it was never activated (no matching activate before this point).`);
      }
    }
  });

  for (const stack of openStack.values()) {
    for (const block of stack) {
      const target = block.getFieldValue("TARGET") as string;
      addMessage(block, `Activates "${target}" but it's never deactivated.`);
    }
  }
}
