import type * as Blockly from "blockly/core";

export const stateToolbox: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "flyoutToolbox",
  contents: [
    {
      kind: "block",
      type: "state_state",
    },
    {
      kind: "block",
      type: "state_transition",
    },
    {
      kind: "block",
      type: "state_choice",
    },
    {
      kind: "block",
      type: "state_composite",
    },
    {
      kind: "block",
      type: "state_raw_line",
    },
  ],
};
