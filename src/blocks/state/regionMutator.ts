import * as Blockly from "blockly/core";
import { STATE_STATEMENT } from "./constants";

/**
 * state_composite always has one mandatory region (the DO input, defined
 * statically in the block's JSON). The mutator adds/removes further
 * concurrent regions (REGION1, REGION2, ...), each preceded by a "--"
 * separator, following the same pattern as activity/forkMutator.ts (which
 * has two mandatory branches instead of one).
 */
interface StateCompositeBlock extends Blockly.Block {
  extraRegionCount_: number;
}

function rebuildShape(block: StateCompositeBlock): void {
  // Remove all region inputs (index >= 1), then re-add the current count.
  let i = 1;
  while (block.getInput(`REGION_SEP_${i}`)) {
    block.removeInput(`REGION_SEP_${i}`);
    block.removeInput(`REGION${i}`);
    i++;
  }
  for (let j = 0; j < block.extraRegionCount_; j++) {
    const index = 1 + j;
    block.appendDummyInput(`REGION_SEP_${index}`).appendField("--");
    block.appendStatementInput(`REGION${index}`).setCheck(STATE_STATEMENT);
  }
}

const stateRegionMutatorMixin = {
  extraRegionCount_: 0,

  saveExtraState(this: StateCompositeBlock): { extraRegionCount: number } {
    return { extraRegionCount: this.extraRegionCount_ };
  },

  loadExtraState(this: StateCompositeBlock, state: { extraRegionCount?: number }): void {
    this.extraRegionCount_ = state.extraRegionCount ?? 0;
    rebuildShape(this);
  },

  decompose(this: StateCompositeBlock, workspace: Blockly.Workspace): Blockly.Block {
    const containerBlock = workspace.newBlock("state_region_mutator_container") as Blockly.BlockSvg;
    containerBlock.initSvg();
    containerBlock.render();

    let connection = containerBlock.getInput("STACK")!.connection!;
    for (let i = 0; i < this.extraRegionCount_; i++) {
      const itemBlock = workspace.newBlock("state_region_mutator_region") as Blockly.BlockSvg;
      itemBlock.initSvg();
      itemBlock.render();
      connection.connect(itemBlock.previousConnection!);
      connection = itemBlock.nextConnection!;
    }
    return containerBlock;
  },

  compose(this: StateCompositeBlock, containerBlock: Blockly.Block): void {
    let count = 0;
    let itemBlock = containerBlock.getInputTargetBlock("STACK");
    while (itemBlock) {
      count++;
      itemBlock = itemBlock.getNextBlock();
    }
    this.extraRegionCount_ = count;
    rebuildShape(this);
  },
};

export function defineStateRegionMutator(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "state_region_mutator_container",
      message0: "regions %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "STACK" },
      ],
      colour: 290,
      tooltip: "Drag in \"region\" blocks to add more concurrent regions.",
    },
    {
      type: "state_region_mutator_region",
      message0: "region",
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
  ]);

  if (!Blockly.Extensions.isRegistered("state_region_mutator")) {
    Blockly.Extensions.registerMutator(
      "state_region_mutator",
      stateRegionMutatorMixin,
      undefined,
      ["state_region_mutator_region"],
    );
  }
}
