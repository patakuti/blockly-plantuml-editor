import * as Blockly from "blockly/core";
import type { ComponentImportedNode } from "./componentImportParser";
import { setFieldValueRefreshingDropdown } from "../blocks/common/setDropdownFieldValue";
import { registerIneligible } from "../blocks/common/autoDefaultTracking";

/** A Dependency block whose FROM/TO assignment is deferred until every Component in the tree exists (see buildComponentWorkspace). */
interface PendingDependency {
  block: Blockly.Block;
  from: string;
  to: string;
}

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
 * Dependency blocks get their FROM/TO set only after the whole tree is built
 * (see assignDependencyFields), not at creation time -- see that function's
 * comment for why.
 *
 * Replaces the entire workspace: callers are expected to have already
 * confirmed this with the user when there was something to lose
 * (01_requirements.md FR-IMPORT-05, handled in ui/importDialog.ts).
 */
export function buildComponentWorkspace(workspace: Blockly.Workspace, nodes: ComponentImportedNode[]): void {
  Blockly.Events.setGroup(true);
  try {
    workspace.clear();
    const pending: PendingDependency[] = [];
    buildChain(workspace, nodes, pending);
    assignDependencyFields(pending);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

/**
 * Sets each Dependency's FROM/TO once every Component in the tree has been
 * created, rather than at the Dependency's own creation time.
 *
 * Component names have no declaration-order constraint (02_design.md 27.2),
 * so a Dependency can reference one that's declared later in the source and
 * therefore doesn't exist in the workspace yet when that Dependency block is
 * built (buildChain/attachChain build in one single pass, in source order).
 * Setting FROM/TO at creation time in that case, then "refreshing" them again
 * to the same value once every Component exists, was tried first and found
 * (via manual browser testing, not caught by any headless test) to leave the
 * on-screen label stuck on the field's very first cached option
 * ("(no components)") forever: FieldDropdown only recomputes its displayed
 * text when doValueUpdate_ actually runs, and that's skipped whenever
 * setFieldValue is called with a value equal to the field's current one --
 * exactly what a same-value "refresh" does. The underlying value (and thus
 * componentWorkspaceToCode's output) was correct throughout; only the label
 * was wrong, permanently, until the user manually picked a different value
 * and back. Deferring the *first* (and only) FROM/TO assignment to this
 * single pass instead avoids the bug entirely, since by then the referenced
 * Component always already exists as a real option and doValueUpdate_
 * resolves it correctly on that first and only assignment.
 */
function assignDependencyFields(pending: PendingDependency[]): void {
  for (const { block, from, to } of pending) {
    setFieldValueRefreshingDropdown(block, "FROM", from);
    setFieldValueRefreshingDropdown(block, "TO", to);
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
function buildChain(
  workspace: Blockly.Workspace,
  nodes: ComponentImportedNode[],
  pending: PendingDependency[],
): Blockly.Block | null {
  let first: Blockly.Block | null = null;
  let previous: Blockly.Block | null = null;
  for (const node of nodes) {
    const block = buildBlock(workspace, node, pending);
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
  pending: PendingDependency[],
): void {
  const first = buildChain(workspace, nodes, pending);
  if (!first) return;
  block.getInput(inputName)!.connection!.connect(first.previousConnection!);
}

function buildBlock(
  workspace: Blockly.Workspace,
  node: ComponentImportedNode,
  pending: PendingDependency[],
): Blockly.Block {
  const block = createBlockForNode(workspace, node, pending);
  finishBlock(block);
  // Already carries its real field values (parsed from the imported PlantUML source),
  // so Round 19's auto-default must not treat it as a freshly-dropped blank block
  // (02_design.md 24.4, same fix as stateImportBuilder.ts/sequenceImportBuilder.ts).
  registerIneligible([block.id]);
  return block;
}

function createBlockForNode(
  workspace: Blockly.Workspace,
  node: ComponentImportedNode,
  pending: PendingDependency[],
): Blockly.Block {
  switch (node.kind) {
    case "component": {
      const block = workspace.newBlock("component_component");
      block.setFieldValue(node.name, "NAME");
      attachChain(workspace, block, "DO", node.body, pending);
      return block;
    }

    case "dependency": {
      const block = workspace.newBlock("component_dependency");
      block.setFieldValue(node.text ?? "", "TEXT");
      pending.push({ block, from: node.from, to: node.to });
      return block;
    }

    case "raw": {
      const block = workspace.newBlock("component_raw_line");
      block.setFieldValue(node.text, "TEXT");
      return block;
    }
  }
}
