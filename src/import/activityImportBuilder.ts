import * as Blockly from "blockly/core";
import type { ImportedNode } from "./activityImportParser";
import { setNoteDirection } from "../generators/common/noteWrapper";

/**
 * Turns a parsed node tree (activityImportParser.ts) into real blocks in
 * `workspace` (02_design.md 15.4). Builds with the plain Block API
 * (`workspace.newBlock` + connections), the same idiom this project's own
 * tests and activity_fork's mutator (forkMutator.ts decompose) already use,
 * rather than hand-assembling `Blockly.serialization` state objects.
 *
 * Replaces the entire workspace: callers are expected to have already
 * confirmed this with the user when there was something to lose
 * (01_requirements.md FR-IMPORT-05, handled in ui/importDialog.ts).
 */
export function buildActivityWorkspace(workspace: Blockly.Workspace, nodes: ImportedNode[]): void {
  Blockly.Events.setGroup(true);
  try {
    workspace.clear();
    buildChain(workspace, nodes);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

function finishBlock(block: Blockly.Block): void {
  if (block.workspace instanceof Blockly.WorkspaceSvg) {
    const svgBlock = block as Blockly.BlockSvg;
    svgBlock.initSvg();
    svgBlock.render();
  }
}

/** Builds `nodes` as a chain of connected sibling blocks. Returns the first block, or null if `nodes` is empty. */
function buildChain(workspace: Blockly.Workspace, nodes: ImportedNode[]): Blockly.Block | null {
  let first: Blockly.Block | null = null;
  let previous: Blockly.Block | null = null;
  for (const node of nodes) {
    const block = buildBlock(workspace, node);
    if (previous) previous.nextConnection!.connect(block.previousConnection!);
    else first = block;
    previous = block;
  }
  return first;
}

/** Builds `nodes` as a chain and, if non-empty, connects it into `block`'s named statement input. */
function attachChain(workspace: Blockly.Workspace, block: Blockly.Block, inputName: string, nodes: ImportedNode[]): void {
  const first = buildChain(workspace, nodes);
  if (!first) return;
  block.getInput(inputName)!.connection!.connect(first.previousConnection!);
}

function buildBlock(workspace: Blockly.Workspace, node: ImportedNode): Blockly.Block {
  const block = createBlockForNode(workspace, node);
  finishBlock(block);
  if (node.comment) {
    block.setCommentText(node.comment.text);
    setNoteDirection(block, node.comment.direction);
  }
  return block;
}

function createBlockForNode(workspace: Blockly.Workspace, node: ImportedNode): Blockly.Block {
  switch (node.kind) {
    case "start":
      // The SWIMLANE pin (FR-ACT-11) is not reconstructed on import -- see
      // 02_design.md 15.3's "known limitations". Imported starts default to
      // "(auto)", same as a freshly placed activity_start block.
      return workspace.newBlock("activity_start");

    case "stop":
      return workspace.newBlock("activity_stop");

    case "action": {
      const block = workspace.newBlock("activity_action");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }

    case "raw": {
      const block = workspace.newBlock("activity_raw_line");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }

    case "swimlane": {
      const block = workspace.newBlock("activity_swimlane");
      block.setFieldValue(node.name, "NAME");
      return block;
    }

    case "partition": {
      const block = workspace.newBlock("activity_partition");
      block.setFieldValue(node.name, "NAME");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "while": {
      const block = workspace.newBlock("activity_while");
      block.setFieldValue(node.cond, "COND");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "repeat": {
      const block = workspace.newBlock("activity_repeat");
      block.setFieldValue(node.cond, "COND");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "if": {
      const block = workspace.newBlock("activity_if");
      block.setFieldValue(node.cond, "COND");
      block.setFieldValue(node.thenLabel, "THEN_LABEL");
      attachChain(workspace, block, "DO0", node.thenBody);
      if (node.elseBody) {
        // Toggling the checkbox field (rather than loadExtraState) is what
        // both rebuilds the ELSE_ROW/ELSE input *and* keeps the checkbox's
        // own visual state truthful -- see ifElseToggle.ts's validator.
        block.setFieldValue("TRUE", "ELSE_TOGGLE");
        block.setFieldValue(node.elseLabel ?? "", "ELSE_LABEL");
        attachChain(workspace, block, "ELSE", node.elseBody);
      }
      return block;
    }

    case "fork": {
      const block = workspace.newBlock("activity_fork");
      if (node.branches.length > 2) {
        block.loadExtraState!({ extraBranchCount: node.branches.length - 2 });
      }
      // Fewer than 2 branches (a "fork" with no "fork again") is malformed
      // PlantUML; BRANCH1 is simply left empty rather than rejected outright.
      node.branches.forEach((branch, index) => attachChain(workspace, block, `BRANCH${index}`, branch));
      return block;
    }
  }
}
