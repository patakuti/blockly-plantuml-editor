import * as Blockly from "blockly/core";
import { defineActivityIfMutator } from "./ifMutator";
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
      message0: "if ( %1 ) then (yes)",
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
          name: "DO0",
          check: ACTIVITY_STATEMENT,
        },
      ],
      previousStatement: ACTIVITY_STATEMENT,
      nextStatement: ACTIVITY_STATEMENT,
      colour: 210,
      tooltip: "Branch based on a condition. Use the gear icon to add/remove an else branch.",
      mutator: "activity_if_mutator",
    },
  ]);

  defineActivityIfMutator();
}
