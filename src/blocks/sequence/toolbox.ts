import type * as Blockly from "blockly/core";

export const sequenceToolbox: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "flyoutToolbox",
  contents: [
    {
      kind: "block",
      type: "sequence_participant",
    },
    {
      kind: "block",
      type: "sequence_message",
    },
  ],
};
