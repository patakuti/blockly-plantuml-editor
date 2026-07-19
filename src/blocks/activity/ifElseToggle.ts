import * as Blockly from "blockly/core";
import { ACTIVITY_STATEMENT } from "./constants";

/**
 * Adds/removes the optional "else" branch on activity_if via a checkbox on
 * the block face, rather than the gear-icon mutator dialog this used to be
 * (open dialog -> drag in an "else" block -> close dialog). PlantUML's
 * new-syntax if only ever has one else, not elseif chains, so a boolean
 * toggle is all the shape needs (01_requirements.md FR-ACT-07).
 *
 * Registered via `registerMutator` (not a plain extension) purely to use its
 * `saveExtraState`/`loadExtraState` serialization hooks -- Blockly forbids
 * adding those from a plain extension. Passing no `compose`/`decompose` (and
 * no mutator block list) means Blockly never attaches the gear-icon UI those
 * would otherwise create.
 */
interface ActivityIfBlock extends Blockly.Block {
  elseCount_: number;
}

function rebuildShape(block: ActivityIfBlock): void {
  const hasElseRow = block.getInput("ELSE_ROW") !== null;
  if (block.elseCount_ && !hasElseRow) {
    block
      .appendDummyInput("ELSE_ROW")
      .appendField("else (")
      .appendField(new Blockly.FieldTextInput("no"), "ELSE_LABEL")
      .appendField(")");
    block.appendStatementInput("ELSE").setCheck(ACTIVITY_STATEMENT);
  } else if (!block.elseCount_ && hasElseRow) {
    block.removeInput("ELSE_ROW");
    block.removeInput("ELSE");
  }
}

const activityIfElseMixin = {
  elseCount_: 0,

  saveExtraState(this: ActivityIfBlock): { elseCount: number } {
    return { elseCount: this.elseCount_ };
  },

  loadExtraState(this: ActivityIfBlock, state: { elseCount?: number }): void {
    this.elseCount_ = state.elseCount ?? 0;
    rebuildShape(this);
  },
};

function wireElseToggleField(this: ActivityIfBlock): void {
  const toggle = this.getField("ELSE_TOGGLE") as Blockly.FieldCheckbox;
  toggle.setValidator((newValue) => {
    this.elseCount_ = newValue === "TRUE" || newValue === true ? 1 : 0;
    rebuildShape(this);
    return newValue;
  });
}

export function defineActivityIfElseToggle(): void {
  if (!Blockly.Extensions.isRegistered("activity_if_else_toggle")) {
    Blockly.Extensions.registerMutator("activity_if_else_toggle", activityIfElseMixin, wireElseToggleField);
  }
}
