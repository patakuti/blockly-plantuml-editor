import * as Blockly from "blockly/core";
import type { StateImportedNode } from "./stateImportParser";
import { setNoteDirection } from "../generators/common/noteWrapper";
import { setFieldValueRefreshingDropdown } from "../blocks/common/setDropdownFieldValue";
import { registerIneligible } from "../blocks/common/autoDefaultTracking";
import { setNameSilently } from "../blocks/common/duplicateName";

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
    refreshTransitionDropdownText(workspace);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

/**
 * State/Composite/Choice names have no declaration-order constraint
 * (02_design.md 18.2), so a Transition can reference one that's declared
 * later in the source and therefore doesn't exist in the workspace yet when
 * that Transition block is built (buildChain/attachChain build in one
 * single pass, in source order). setFieldValueRefreshingDropdown's cache
 * refresh only helps against *stale* options; it can't include an option
 * for a block that hasn't been created yet, so such a Transition's on-screen
 * FROM/TO label is wrong immediately after import even though the
 * underlying field value (and therefore stateWorkspaceToCode's output) is
 * already correct. Once every node is built, all names exist, so a second
 * refresh pass over every Transition fixes the display without touching any
 * value (confirmed live in a running WorkspaceSvg, not just headless: the
 * generated PlantUML text was correct throughout, only the dropdown label
 * was stale).
 */
function refreshTransitionDropdownText(workspace: Blockly.Workspace): void {
  for (const block of workspace.getBlocksByType("state_transition", false)) {
    setFieldValueRefreshingDropdown(block, "FROM", block.getFieldValue("FROM"));
    setFieldValueRefreshingDropdown(block, "TO", block.getFieldValue("TO"));
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
  // Already carries its real field values (parsed from the imported PlantUML source),
  // so Round 14's auto-default must not treat it as a freshly-dropped blank block
  // (02_design.md 24.4).
  registerIneligible([block.id]);
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
      setNameSilently(block, node.name);
      return block;
    }

    case "choice": {
      const block = workspace.newBlock("state_choice");
      setNameSilently(block, node.name);
      return block;
    }

    case "fork": {
      const block = workspace.newBlock("state_fork");
      setNameSilently(block, node.name);
      return block;
    }

    case "join": {
      const block = workspace.newBlock("state_join");
      setNameSilently(block, node.name);
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
      setNameSilently(block, node.name);
      if (node.regions.length > 1) {
        block.loadExtraState!({ extraRegionCount: node.regions.length - 1 });
      }
      node.regions.forEach((region, index) => {
        attachChain(workspace, block, index === 0 ? "DO" : `REGION${index}`, region);
      });
      return block;
    }

    case "raw": {
      const block = workspace.newBlock("state_raw_line");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }
  }
}
