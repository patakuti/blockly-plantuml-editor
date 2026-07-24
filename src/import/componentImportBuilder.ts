import * as Blockly from "blockly/core";
import type { ComponentImportedNode } from "./componentImportParser";
import { setFieldValueRefreshingDropdown } from "../blocks/common/setDropdownFieldValue";

/**
 * Turns a parsed node tree (componentImportParser.ts) into real blocks in
 * `workspace` (02_design.md 28.3), the same idiom as
 * activityImportBuilder.ts/stateImportBuilder.ts (plain Block API,
 * `workspace.newBlock` + connections, no `Blockly.serialization`). There's no
 * declaration-chain/body-chain split to reconstruct (01_requirements.md
 * FR-COMP-IMPORT-05): component diagrams have a single COMPONENT_STATEMENT
 * connection type, so the parser's flat node list is built as one single
 * chain, same as activityImportBuilder.ts/stateImportBuilder.ts.
 *
 * Replaces the entire workspace: callers are expected to have already
 * confirmed this with the user when there was something to lose
 * (01_requirements.md FR-IMPORT-05, handled in ui/importDialog.ts).
 */
export function buildComponentWorkspace(workspace: Blockly.Workspace, nodes: ComponentImportedNode[]): void {
  Blockly.Events.setGroup(true);
  try {
    workspace.clear();
    buildChain(workspace, nodes);
    refreshDependencyDropdownText(workspace);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

/**
 * Component names have no declaration-order constraint (02_design.md 27.2),
 * so a Dependency can reference one that's declared later in the source and
 * therefore doesn't exist in the workspace yet when that Dependency block is
 * built (buildChain/attachChain build in one single pass, in source order).
 * Same fix as stateImportBuilder.ts's refreshTransitionDropdownText: once
 * every node is built, all names exist, so a second refresh pass over every
 * Dependency fixes the on-screen FROM/TO label without touching the
 * underlying value (which was already correct throughout).
 */
function refreshDependencyDropdownText(workspace: Blockly.Workspace): void {
  for (const block of workspace.getBlocksByType("component_dependency", false)) {
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
function buildChain(workspace: Blockly.Workspace, nodes: ComponentImportedNode[]): Blockly.Block | null {
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
  nodes: ComponentImportedNode[],
): void {
  const first = buildChain(workspace, nodes);
  if (!first) return;
  block.getInput(inputName)!.connection!.connect(first.previousConnection!);
}

function buildBlock(workspace: Blockly.Workspace, node: ComponentImportedNode): Blockly.Block {
  const block = createBlockForNode(workspace, node);
  finishBlock(block);
  return block;
}

function createBlockForNode(workspace: Blockly.Workspace, node: ComponentImportedNode): Blockly.Block {
  switch (node.kind) {
    case "component": {
      const block = workspace.newBlock("component_component");
      block.setFieldValue(node.name, "NAME");
      attachChain(workspace, block, "DO", node.body);
      return block;
    }

    case "dependency": {
      const block = workspace.newBlock("component_dependency");
      setFieldValueRefreshingDropdown(block, "FROM", node.from);
      setFieldValueRefreshingDropdown(block, "TO", node.to);
      block.setFieldValue(node.text ?? "", "TEXT");
      return block;
    }

    case "raw": {
      const block = workspace.newBlock("component_raw_line");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }
  }
}
