import * as Blockly from "blockly/core";
import { ACTIVITY_STATEMENT } from "./constants";

/**
 * Adds/removes the optional "else" branch on activity_if, following the same
 * saveExtraState/loadExtraState + decompose/compose mutator pattern Blockly's
 * own controls_if uses, simplified to a single boolean (has-else or not) since
 * PlantUML's new-syntax if only supports one else, not elseif chains.
 */
interface ActivityIfBlock extends Blockly.Block {
  elseCount_: number;
}

function rebuildShape(block: ActivityIfBlock): void {
  const hasElseInput = block.getInput("ELSE_LABEL") !== null;
  if (block.elseCount_ && !hasElseInput) {
    block.appendDummyInput("ELSE_LABEL").appendField("else (no)");
    block.appendStatementInput("ELSE").setCheck(ACTIVITY_STATEMENT);
  } else if (!block.elseCount_ && hasElseInput) {
    block.removeInput("ELSE_LABEL");
    block.removeInput("ELSE");
  }
}

const activityIfMutatorMixin = {
  elseCount_: 0,

  saveExtraState(this: ActivityIfBlock): { elseCount: number } {
    return { elseCount: this.elseCount_ };
  },

  loadExtraState(this: ActivityIfBlock, state: { elseCount?: number }): void {
    this.elseCount_ = state.elseCount ?? 0;
    rebuildShape(this);
  },

  decompose(this: ActivityIfBlock, workspace: Blockly.Workspace): Blockly.Block {
    const containerBlock = workspace.newBlock("activity_if_mutator_container") as Blockly.BlockSvg;
    containerBlock.initSvg();
    containerBlock.render();

    const connection = containerBlock.getInput("STACK")!.connection!;
    if (this.elseCount_) {
      const elseBlock = workspace.newBlock("activity_if_mutator_else") as Blockly.BlockSvg;
      elseBlock.initSvg();
      elseBlock.render();
      connection.connect(elseBlock.previousConnection!);
    }
    return containerBlock;
  },

  compose(this: ActivityIfBlock, containerBlock: Blockly.Block): void {
    const elseBlock = containerBlock.getInputTargetBlock("STACK");
    this.elseCount_ = elseBlock ? 1 : 0;
    rebuildShape(this);
  },
};

export function defineActivityIfMutator(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "activity_if_mutator_container",
      message0: "if %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "STACK" },
      ],
      colour: 210,
      tooltip: "Drag in an \"else\" block to add an else branch.",
    },
    {
      type: "activity_if_mutator_else",
      message0: "else",
      previousStatement: null,
      nextStatement: null,
      colour: 210,
    },
  ]);

  if (!Blockly.Extensions.isRegistered("activity_if_mutator")) {
    Blockly.Extensions.registerMutator(
      "activity_if_mutator",
      activityIfMutatorMixin,
      undefined,
      ["activity_if_mutator_else"],
    );
  }
}
