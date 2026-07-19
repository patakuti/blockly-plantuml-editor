import * as Blockly from "blockly/core";
import { ACTIVITY_STATEMENT } from "./constants";

/**
 * activity_fork always has two mandatory branches (BRANCH0, BRANCH1, defined
 * statically in the block's JSON). The mutator adds/removes further optional
 * branches (BRANCH2, BRANCH3, ...), each preceded by a "fork again" label,
 * following the same list-style pattern Blockly's own lists_create_with uses
 * (decompose builds a chain of item blocks in the mutator workspace; compose
 * counts the chain length back out).
 */
interface ActivityForkBlock extends Blockly.Block {
  extraBranchCount_: number;
}

function rebuildShape(block: ActivityForkBlock): void {
  // Remove all optional branch inputs (index >= 2), then re-add the current count.
  let i = 2;
  while (block.getInput(`FORK_AGAIN_${i}`)) {
    block.removeInput(`FORK_AGAIN_${i}`);
    block.removeInput(`BRANCH${i}`);
    i++;
  }
  for (let j = 0; j < block.extraBranchCount_; j++) {
    const index = 2 + j;
    block.appendDummyInput(`FORK_AGAIN_${index}`).appendField("fork again");
    block.appendStatementInput(`BRANCH${index}`).setCheck(ACTIVITY_STATEMENT);
  }
}

const activityForkMutatorMixin = {
  extraBranchCount_: 0,

  saveExtraState(this: ActivityForkBlock): { extraBranchCount: number } {
    return { extraBranchCount: this.extraBranchCount_ };
  },

  loadExtraState(this: ActivityForkBlock, state: { extraBranchCount?: number }): void {
    this.extraBranchCount_ = state.extraBranchCount ?? 0;
    rebuildShape(this);
  },

  decompose(this: ActivityForkBlock, workspace: Blockly.Workspace): Blockly.Block {
    const containerBlock = workspace.newBlock("activity_fork_mutator_container") as Blockly.BlockSvg;
    containerBlock.initSvg();
    containerBlock.render();

    let connection = containerBlock.getInput("STACK")!.connection!;
    for (let i = 0; i < this.extraBranchCount_; i++) {
      const itemBlock = workspace.newBlock("activity_fork_mutator_branch") as Blockly.BlockSvg;
      itemBlock.initSvg();
      itemBlock.render();
      connection.connect(itemBlock.previousConnection!);
      connection = itemBlock.nextConnection!;
    }
    return containerBlock;
  },

  compose(this: ActivityForkBlock, containerBlock: Blockly.Block): void {
    let count = 0;
    let itemBlock = containerBlock.getInputTargetBlock("STACK");
    while (itemBlock) {
      count++;
      itemBlock = itemBlock.getNextBlock();
    }
    this.extraBranchCount_ = count;
    rebuildShape(this);
  },
};

export function defineActivityForkMutator(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "activity_fork_mutator_container",
      message0: "fork %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "STACK" },
      ],
      colour: 210,
      tooltip: "Drag in \"branch\" blocks to add more fork branches.",
    },
    {
      type: "activity_fork_mutator_branch",
      message0: "branch",
      previousStatement: null,
      nextStatement: null,
      colour: 210,
    },
  ]);

  if (!Blockly.Extensions.isRegistered("activity_fork_mutator")) {
    Blockly.Extensions.registerMutator(
      "activity_fork_mutator",
      activityForkMutatorMixin,
      undefined,
      ["activity_fork_mutator_branch"],
    );
  }
}
