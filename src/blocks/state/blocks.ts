import * as Blockly from "blockly/core";
import { STATE_STATEMENT } from "./constants";
import { defineStateRegionMutator } from "./regionMutator";

/** The pseudostate token for the start/end of a state diagram (or of a composite state's own region). */
const PSEUDOSTATE = "[*]";

/**
 * Shallow/deep history pseudostate tokens (FR-STATE-15). Bare, they mean
 * "this composite state's own history" when used from inside its own body
 * (the same scoping rule "[*]" already gets). Suffixed onto a declared
 * Composite State's name (e.g. "Foo[H]"), they reference that composite's
 * history from anywhere else -- confirmed against the official PlantUML
 * server (02_design.md 38.1) to be the form actually used in practice.
 */
const SHALLOW_HISTORY = "[H]";
const DEEP_HISTORY = "[H*]";

/**
 * Matches a space or a `"` (FR-STATE-12/13). State/Composite State/Choice
 * names are emitted as bare, unquoted PlantUML identifiers (`state Name`),
 * unlike Sequence/Component's always-quoted names -- either character breaks
 * PlantUML's state-diagram parser outright (verified against a local
 * PlantUML render, 02_design.md 35.1). Exported so blocks/state/validation.ts
 * can flag the same condition without duplicating the pattern.
 */
export const INVALID_STATE_NAME_PATTERN = /[ "]/;

/**
 * Scans the workspace for declared states (state_state, state_composite,
 * and state_choice -- all of which can be a transition endpoint) plus the
 * pseudostate marker, and returns them as dropdown options for Transition's
 * "from"/"to" fields (02_design.md 18.3, extended for choice in 22.2).
 */
function stateOptions(this: Blockly.FieldDropdown): Blockly.MenuOption[] {
  const block = this.getSourceBlock();
  if (!block) return [[PSEUDOSTATE, PSEUDOSTATE]];

  const compositeBlocks = block.workspace.getBlocksByType("state_composite", true);
  const names = [
    ...block.workspace.getBlocksByType("state_state", true),
    ...compositeBlocks,
    ...block.workspace.getBlocksByType("state_choice", true),
    ...block.workspace.getBlocksByType("state_fork", true),
    ...block.workspace.getBlocksByType("state_join", true),
  ].map((b) => b.getFieldValue("NAME") as string);
  const historyOptions = compositeBlocks.flatMap((b) => {
    const name = b.getFieldValue("NAME") as string;
    return [`${name}${SHALLOW_HISTORY}`, `${name}${DEEP_HISTORY}`];
  });

  const options: Blockly.MenuOption[] = [
    [PSEUDOSTATE, PSEUDOSTATE],
    [SHALLOW_HISTORY, SHALLOW_HISTORY],
    [DEEP_HISTORY, DEEP_HISTORY],
  ];
  return options.concat([...names, ...historyOptions].map((name) => [name, name]));
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

/**
 * State/Composite State/Choice's NAME field (FR-STATE-12). Shows a red
 * outline on the live editor input while it currently contains a space or a
 * `"`, without ever rejecting or rolling back the value itself -- Blockly's
 * standard validator-returns-null rollback mechanism also fires on
 * programmatic setFieldValue (JSON restore, PlantUML import, undo/redo), so
 * using it here would silently rewrite a name that was saved before this
 * validation existed (02_design.md 35.2). The persistent, always-visible
 * counterpart (surviving after the field is no longer being edited) is
 * blocks/state/validation.ts's warning icon (FR-STATE-13).
 */
class StateNameField extends Blockly.FieldTextInput {
  protected override bindInputEvents_(htmlInput: HTMLInputElement): void {
    super.bindInputEvents_(htmlInput);
    htmlInput.addEventListener("input", () => this.updateInvalidStyle_());
    this.updateInvalidStyle_();
  }

  private updateInvalidStyle_(): void {
    this.htmlInput_?.classList.toggle("blocklyInvalidNameInput", INVALID_STATE_NAME_PATTERN.test(this.htmlInput_.value));
  }
}

export function defineStateBlocks(): void {
  defineStateRegionMutator();

  Blockly.Blocks["state_state"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("state").appendField(new StateNameField("State1"), "NAME");
      this.setPreviousStatement(true, STATE_STATEMENT);
      this.setNextStatement(true, STATE_STATEMENT);
      this.setColour(160);
      this.setTooltip("Declares a state.");
    },
  };

  Blockly.Blocks["state_choice"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("choice").appendField(new StateNameField("Choice1"), "NAME");
      this.setPreviousStatement(true, STATE_STATEMENT);
      this.setNextStatement(true, STATE_STATEMENT);
      this.setColour(160);
      this.setTooltip("Declares a choice pseudostate (a branch point). Connect transitions in and out just like a regular state.");
    },
  };

  Blockly.Blocks["state_fork"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("fork").appendField(new StateNameField("Fork1"), "NAME");
      this.setPreviousStatement(true, STATE_STATEMENT);
      this.setNextStatement(true, STATE_STATEMENT);
      this.setColour(160);
      this.setTooltip("Declares a fork pseudostate (splits into concurrent transitions). Connect transitions in and out just like a regular state.");
    },
  };

  Blockly.Blocks["state_join"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("join").appendField(new StateNameField("Join1"), "NAME");
      this.setPreviousStatement(true, STATE_STATEMENT);
      this.setNextStatement(true, STATE_STATEMENT);
      this.setColour(160);
      this.setTooltip("Declares a join pseudostate (merges concurrent transitions). Connect transitions in and out just like a regular state.");
    },
  };

  Blockly.Blocks["state_composite"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("state").appendField(new StateNameField("Composite"), "NAME");
      this.appendStatementInput("DO").setCheck(STATE_STATEMENT);
      this.setPreviousStatement(true, STATE_STATEMENT);
      this.setNextStatement(true, STATE_STATEMENT);
      this.setColour(290);
      this.setTooltip(
        "Groups a sequence of states/transitions as a nested (composite) state. Nestable. " +
          "Use the gear icon to add concurrent regions (separated by \"--\").",
      );
      Blockly.Extensions.apply("state_region_mutator", this, true);
    },
  };

  Blockly.defineBlocksWithJsonArray([
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
