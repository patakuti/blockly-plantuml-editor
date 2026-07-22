import * as Blockly from "blockly/core";
import type { StateImportedNode } from "./stateImportParser";
import { setNoteDirection } from "../generators/common/noteWrapper";
import { setFieldValueRefreshingDropdown } from "../blocks/common/setDropdownFieldValue";

/**
 * Turns a parsed node tree (stateImportParser.ts) into real blocks in
 * `workspace` (02_design.md 19.4), the same idiom as
 * activityImportBuilder.ts/sequenceImportBuilder.ts (plain Block API,
 * `workspace.newBlock` + connections, no `Blockly.serialization`).
 *
 * Unlike sequenceImportBuilder.ts, there's no declaration-chain/body-chain
 * split to reconstruct: state diagrams have a single STATE_STATEMENT
 * connection type (02_design.md 18.2), so the parser's flat node list is
 * built as one single chain, same as activityImportBuilder.ts.
 *
 * Replaces the entire workspace: callers are expected to have already
 * confirmed this with the user when there was something to lose
 * (01_requirements.md FR-IMPORT-05, handled in ui/importDialog.ts).
 */
export function buildStateWorkspace(workspace: Blockly.Workspace, nodes: StateImportedNode[]): void {
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
function buildChain(workspace: Blockly.Workspace, nodes: StateImportedNode[]): Blockly.Block | null {
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
  nodes: StateImportedNode[],
): void {
  const first = buildChain(workspace, nodes);
  if (!first) return;
  block.getInput(inputName)!.connection!.connect(first.previousConnection!);
}

function buildBlock(workspace: Blockly.Workspace, node: StateImportedNode): Blockly.Block {
  const block = createBlockForNode(workspace, node);
  finishBlock(block);
  if (node.comment) {
    block.setCommentText(node.comment.text);
    setNoteDirection(block, node.comment.direction);
  }
  return block;
}

function createBlockForNode(workspace: Blockly.Workspace, node: StateImportedNode): Blockly.Block {
  switch (node.kind) {
    case "state": {
      const block = workspace.newBlock("state_state");
      block.setFieldValue(node.name, "NAME");
      return block;
    }

    case "transition": {
      const block = workspace.newBlock("state_transition");
      setFieldValueRefreshingDropdown(block, "FROM", node.from);
      setFieldValueRefreshingDropdown(block, "TO", node.to);
      block.setFieldValue(node.label ?? "", "LABEL");
      return block;
    }

    case "composite": {
      const block = workspace.newBlock("state_composite");
      block.setFieldValue(node.name, "NAME");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "raw": {
      const block = workspace.newBlock("state_raw_line");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }
  }
}
