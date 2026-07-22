import * as Blockly from "blockly/core";
import type { SequenceImportedNode } from "./sequenceImportParser";
import { setNoteDirection } from "../generators/common/noteWrapper";
import { setFieldValueRefreshingDropdown } from "../blocks/common/setDropdownFieldValue";

/**
 * Turns a parsed node tree (sequenceImportParser.ts) into real blocks in
 * `workspace` (02_design.md 16.4), the same idiom as activityImportBuilder.ts
 * (plain Block API, `workspace.newBlock` + connections, no
 * `Blockly.serialization`).
 *
 * The parser returns one flat, ordered node list (there's no separate
 * grammar for "the participant area" -- see sequenceImportParser.ts's
 * top-of-file comment), so building has to do the split
 * sequenceWorkspaceToCode's generation does in reverse: all `participant`
 * nodes become the PARTICIPANT_STATEMENT chain, everything else becomes the
 * SEQUENCE_STATEMENT chain, each preserving its own relative order. A raw
 * line that appeared between participant declarations in the source
 * therefore always lands in the message-chain group on import (02_design.md
 * 16.6's documented known limitation).
 *
 * Replaces the entire workspace: callers are expected to have already
 * confirmed this with the user when there was something to lose
 * (01_requirements.md FR-IMPORT-05, handled in ui/importDialog.ts).
 */
export function buildSequenceWorkspace(workspace: Blockly.Workspace, nodes: SequenceImportedNode[]): void {
  Blockly.Events.setGroup(true);
  try {
    workspace.clear();
    const participantNodes = nodes.filter((node) => node.kind === "participant");
    const statementNodes = nodes.filter((node) => node.kind !== "participant");
    buildChain(workspace, participantNodes);
    buildChain(workspace, statementNodes);
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
function buildChain(workspace: Blockly.Workspace, nodes: SequenceImportedNode[]): Blockly.Block | null {
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
function attachChain(
  workspace: Blockly.Workspace,
  block: Blockly.Block,
  inputName: string,
  nodes: SequenceImportedNode[],
): void {
  const first = buildChain(workspace, nodes);
  if (!first) return;
  block.getInput(inputName)!.connection!.connect(first.previousConnection!);
}

function buildBlock(workspace: Blockly.Workspace, node: SequenceImportedNode): Blockly.Block {
  const block = createBlockForNode(workspace, node);
  finishBlock(block);
  if (node.comment) {
    block.setCommentText(node.comment.text);
    setNoteDirection(block, node.comment.direction);
  }
  return block;
}

function createBlockForNode(workspace: Blockly.Workspace, node: SequenceImportedNode): Blockly.Block {
  switch (node.kind) {
    case "participant": {
      const block = workspace.newBlock("sequence_participant");
      block.setFieldValue(node.name, "NAME");
      return block;
    }

    case "message": {
      const block = workspace.newBlock("sequence_message");
      setFieldValueRefreshingDropdown(block, "FROM", node.from);
      setFieldValueRefreshingDropdown(block, "TO", node.to);
      block.setFieldValue(node.text, "TEXT");
      return block;
    }

    case "note": {
      const block = workspace.newBlock("sequence_note");
      block.setFieldValue(node.side, "SIDE");
      setFieldValueRefreshingDropdown(block, "TARGET", node.target);
      block.setFieldValue(node.text, "TEXT");
      return block;
    }

    case "raw": {
      const block = workspace.newBlock("sequence_raw_line");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }

    case "opt": {
      const block = workspace.newBlock("sequence_opt");
      block.setFieldValue(node.cond, "COND");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "loop": {
      const block = workspace.newBlock("sequence_loop");
      block.setFieldValue(node.cond, "COND");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "alt": {
      const block = workspace.newBlock("sequence_alt");
      block.setFieldValue(node.cond, "COND");
      attachChain(workspace, block, "DO0", node.body);
      if (node.elseBranches.length > 0) {
        block.loadExtraState!({ extraElseCount: node.elseBranches.length });
        node.elseBranches.forEach((branch, index) => {
          const i = index + 1;
          block.setFieldValue(branch.cond, `ELSE_COND_${i}`);
          attachChain(workspace, block, `ELSE_BODY_${i}`, branch.body);
        });
      }
      return block;
    }
  }
}
