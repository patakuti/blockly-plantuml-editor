import * as Blockly from "blockly/core";

/** Shared connection-check type: only activity statements may chain together. */
const ACTIVITY_STATEMENT = "ActivityStatement";

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
  ]);
}
