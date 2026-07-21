import * as Blockly from "blockly/core";
import { defineActivityIfElseToggle } from "./ifElseToggle";
import { defineActivityForkMutator } from "./forkMutator";
import { ACTIVITY_STATEMENT } from "./constants";

/**
 * Scans the workspace for declared swimlanes (deduplicated, in position
 * order) and returns them as dropdown options for the start block's SWIMLANE
 * field, plus a leading "(auto)" option (empty string) meaning "no pin --
 * let activityWorkspaceToCode's default hoist order decide" (02_design.md
 * 14.5). Unlike participantOptions in sequence/blocks.ts, this never needs a
 * "none available" placeholder: "(auto)" is always a valid, meaningful
 * choice on its own.
 */
function swimlaneOptions(this: Blockly.FieldDropdown): Blockly.MenuOption[] {
  const block = this.getSourceBlock();
  const rawNames = block
    ? block.workspace.getBlocksByType("activity_swimlane", true).map((b) => b.getFieldValue("NAME") as string)
    : [];
  const names = [...new Set(rawNames)];
  return [["(auto)", ""], ...names.map((name): Blockly.MenuOption => [name, name])];
}

/**
 * Same rationale as ParticipantDropdownField in sequence/blocks.ts: without
 * this override, Blockly's default FieldDropdown validation rejects any
 * saved SWIMLANE value that isn't in the *current* dynamically-computed
 * options list (e.g. right after construction, or after the referenced
 * activity_swimlane block was renamed/deleted), silently wiping the field.
 * Accepting any string here instead surfaces a stale reference as a
 * validateActivityWorkspace warning (14.5) rather than losing the value.
 */
class SwimlaneDropdownField extends Blockly.FieldDropdown {
  protected override doClassValidation_(newValue: string): string | null | undefined;
  protected override doClassValidation_(newValue?: string): string | null;
  protected override doClassValidation_(newValue?: string): string | null | undefined {
    return newValue ?? null;
  }
}

export function defineActivityBlocks(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "activity_stop",
      message0: "stop",
      previousStatement: ACTIVITY_STATEMENT,
      colour: 0,
      tooltip: "Diagram exit point.",
    },
    {
      type: "activity_action",
      message0: "%1",
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "action",
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "A single activity step.",
    },
    {
      type: "activity_if",
      message0: "if ( %1 ) then (%2) else? %3",
      args0: [
        {
          type: "field_input",
          name: "COND",
          text: "condition",
        },
        {
          type: "field_input",
          name: "THEN_LABEL",
          text: "yes",
        },
        {
          type: "field_checkbox",
          name: "ELSE_TOGGLE",
          checked: false,
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO0",
          check: ACTIVITY_STATEMENT,
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "Branch based on a condition. Check \"else?\" to add an else branch.",
      mutator: "activity_if_else_toggle",
    },
    {
      type: "activity_while",
      message0: "while ( %1 )",
      args0: [
        {
          type: "field_input",
          name: "COND",
          text: "condition",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: ACTIVITY_STATEMENT,
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "Repeat while a condition holds, checked before each iteration.",
    },
    {
      type: "activity_repeat",
      message0: "repeat",
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: ACTIVITY_STATEMENT,
        },
      ],
      message2: "repeat while ( %1 )",
      args2: [
        {
          type: "field_input",
          name: "COND",
          text: "condition",
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "Repeat until a condition holds, checked after each iteration.",
    },
    {
      type: "activity_fork",
      message0: "fork",
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BRANCH0",
          check: ACTIVITY_STATEMENT,
        },
      ],
      message2: "fork again",
      message3: "%1",
      args3: [
        {
          type: "input_statement",
          name: "BRANCH1",
          check: ACTIVITY_STATEMENT,
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "Split into parallel branches. Use the gear icon to add/remove branches.",
      mutator: "activity_fork_mutator",
    },
    {
      type: "activity_partition",
      message0: "partition %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "partition",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: ACTIVITY_STATEMENT,
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "Group a sequence of statements under a named partition. Can be nested.",
    },
    {
      type: "activity_swimlane",
      message0: "swimlane %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "lane",
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip:
        "Switch the current swimlane for subsequent statements. Reorder these blocks to control lane display order.",
    },
    {
      type: "activity_raw_line",
      message0: "raw %1",
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "'",
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 330,
      tooltip:
        "Emits its text as a single line of PlantUML, verbatim and unescaped. " +
        "Use it for syntax this app doesn't have a block for, or as a placeholder for lines an import couldn't recognize.",
    },
  ]);

  Blockly.Blocks["activity_start"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("start")
        .appendField("in")
        .appendField(new SwimlaneDropdownField(swimlaneOptions), "SWIMLANE");
      this.setNextStatement(true, ACTIVITY_STATEMENT);
      this.setColour(120);
      this.setTooltip(
        "Diagram entry point. Pin a swimlane to control which lane it's drawn in (defaults to automatic).",
      );
    },
  };

  defineActivityIfElseToggle();
  defineActivityForkMutator();
}
