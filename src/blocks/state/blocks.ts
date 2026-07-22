import * as Blockly from "blockly/core";
import { STATE_STATEMENT } from "./constants";
import { defineStateRegionMutator } from "./regionMutator";

/** The pseudostate token for the start/end of a state diagram (or of a composite state's own region). */
const PSEUDOSTATE = "[*]";

/**
 * Scans the workspace for declared states (state_state, state_composite,
 * and state_choice -- all of which can be a transition endpoint) plus the
 * pseudostate marker, and returns them as dropdown options for Transition's
 * "from"/"to" fields (02_design.md 18.3, extended for choice in 22.2).
 */
function stateOptions(this: Blockly.FieldDropdown): Blockly.MenuOption[] {
  const block = this.getSourceBlock();
  const names = block
    ? [
        ...block.workspace.getBlocksByType("state_state", true),
        ...block.workspace.getBlocksByType("state_composite", true),
        ...block.workspace.getBlocksByType("state_choice", true),
      ].map((b) => b.getFieldValue("NAME") as string)
    : [];
  const options: Blockly.MenuOption[] = [[PSEUDOSTATE, PSEUDOSTATE]];
  return options.concat(names.map((name) => [name, name]));
}

/**
 * Accepts any string value, not just the field's current options list.
 * Same rationale as sequence/blocks.ts's ParticipantDropdownField: without
 * this, a state referenced by a Transition before it's declared (or one that
 * gets renamed/deleted later) would have its FROM/TO value silently rejected
 * or wiped on restore. Referencing a name that no longer exists is instead
 * surfaced as a block warning (FR-STATE-06).
 */
class StateDropdownField extends Blockly.FieldDropdown {
  protected override doClassValidation_(newValue: string): string | null | undefined;
  protected override doClassValidation_(newValue?: string): string | null;
  protected override doClassValidation_(newValue?: string): string | null | undefined {
    return newValue ?? null;
  }
}

export function defineStateBlocks(): void {
  defineStateRegionMutator();

  Blockly.defineBlocksWithJsonArray([
    {
      type: "state_state",
      message0: "state %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "State1",
        },
      ],
      previousStatement: STATE_STATEMENT,
      nextStatement: STATE_STATEMENT,
      colour: 160,
      tooltip: "Declares a state.",
    },
    {
      type: "state_choice",
      message0: "choice %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "Choice1",
        },
      ],
      previousStatement: STATE_STATEMENT,
      nextStatement: STATE_STATEMENT,
      colour: 160,
      tooltip: "Declares a choice pseudostate (a branch point). Connect transitions in and out just like a regular state.",
    },
    {
      type: "state_composite",
      message0: "state %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "Composite",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: STATE_STATEMENT,
        },
      ],
      previousStatement: STATE_STATEMENT,
      nextStatement: STATE_STATEMENT,
      colour: 290,
      tooltip:
        "Groups a sequence of states/transitions as a nested (composite) state. Nestable. " +
        "Use the gear icon to add concurrent regions (separated by \"--\").",
      mutator: "state_region_mutator",
    },
    {
      type: "state_raw_line",
      message0: "raw %1",
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "'",
        },
      ],
      previousStatement: STATE_STATEMENT,
      nextStatement: STATE_STATEMENT,
      colour: 330,
      tooltip:
        "Emits its text as a single line of PlantUML, verbatim and unescaped. " +
        "Use it for syntax this app doesn't have a block for (e.g. choice, concurrent regions, history pseudostates).",
    },
  ]);

  Blockly.Blocks["state_transition"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(new StateDropdownField(stateOptions), "FROM")
        .appendField("-->")
        .appendField(new StateDropdownField(stateOptions), "TO")
        .appendField(":")
        .appendField(new Blockly.FieldTextInput(""), "LABEL");
      this.setPreviousStatement(true, STATE_STATEMENT);
      this.setNextStatement(true, STATE_STATEMENT);
      this.setColour(210);
      this.setTooltip(
        "Transitions from one state to another. Use \"[*]\" for the diagram's start/end pseudostate. Label is optional.",
      );
    },
  };
}
