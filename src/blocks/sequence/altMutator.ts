import * as Blockly from "blockly/core";
import { SEQUENCE_STATEMENT } from "./constants";

/**
 * sequence_alt always has one mandatory branch (COND/DO0, defined statically
 * in the block's JSON). The mutator adds/removes further "else" branches
 * (ELSE_COND_1/ELSE_BODY_1, ELSE_COND_2/ELSE_BODY_2, ...), following the same
 * list-style pattern as activity_fork's extra branches.
 */
interface SequenceAltBlock extends Blockly.Block {
  extraElseCount_: number;
}

function rebuildShape(block: SequenceAltBlock): void {
  let i = 1;
  while (block.getInput(`ELSE_LABEL_${i}`)) {
    block.removeInput(`ELSE_LABEL_${i}`);
    block.removeInput(`ELSE_BODY_${i}`);
    i++;
  }
  for (let j = 1; j <= block.extraElseCount_; j++) {
    block
      .appendDummyInput(`ELSE_LABEL_${j}`)
      .appendField("else (")
      .appendField(new Blockly.FieldTextInput("condition"), `ELSE_COND_${j}`)
      .appendField(")");
    block.appendStatementInput(`ELSE_BODY_${j}`).setCheck(SEQUENCE_STATEMENT);
  }
}

const sequenceAltMutatorMixin = {
  extraElseCount_: 0,

  saveExtraState(this: SequenceAltBlock): { extraElseCount: number } {
    return { extraElseCount: this.extraElseCount_ };
  },

  loadExtraState(this: SequenceAltBlock, state: { extraElseCount?: number }): void {
    this.extraElseCount_ = state.extraElseCount ?? 0;
    rebuildShape(this);
  },

  decompose(this: SequenceAltBlock, workspace: Blockly.Workspace): Blockly.Block {
    const containerBlock = workspace.newBlock("sequence_alt_mutator_container") as Blockly.BlockSvg;
    containerBlock.initSvg();
    containerBlock.render();

    let connection = containerBlock.getInput("STACK")!.connection!;
    for (let i = 0; i < this.extraElseCount_; i++) {
      const itemBlock = workspace.newBlock("sequence_alt_mutator_else") as Blockly.BlockSvg;
      itemBlock.initSvg();
      itemBlock.render();
      connection.connect(itemBlock.previousConnection!);
      connection = itemBlock.nextConnection!;
    }
    return containerBlock;
  },

  compose(this: SequenceAltBlock, containerBlock: Blockly.Block): void {
    let count = 0;
    let itemBlock = containerBlock.getInputTargetBlock("STACK");
    while (itemBlock) {
      count++;
      itemBlock = itemBlock.getNextBlock();
    }
    this.extraElseCount_ = count;
    rebuildShape(this);
  },
};

export function defineSequenceAltMutator(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "sequence_alt_mutator_container",
      message0: "alt %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "STACK" },
      ],
      colour: 210,
      tooltip: "Drag in \"else\" blocks to add more alt branches.",
    },
    {
      type: "sequence_alt_mutator_else",
      message0: "else",
      previousStatement: null,
      nextStatement: null,
      colour: 210,
    },
  ]);

  if (!Blockly.Extensions.isRegistered("sequence_alt_mutator")) {
    Blockly.Extensions.registerMutator(
      "sequence_alt_mutator",
      sequenceAltMutatorMixin,
      undefined,
      ["sequence_alt_mutator_else"],
    );
  }
}
