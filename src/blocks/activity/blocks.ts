import * as Blockly from "blockly/core";
import { defineActivityIfElseToggle } from "./ifElseToggle";
import { defineActivityForkMutator } from "./forkMutator";
import { ACTIVITY_STATEMENT } from "./constants";

export function defineActivityBlocks(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "activity_start",
      message0: "start",
      nextStatement: ACTIVITY_STATEMENT,
      colour: 120,
      tooltip: "Diagram entry point.",
    },
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
  ]);

  defineActivityIfElseToggle();
  defineActivityForkMutator();
}
