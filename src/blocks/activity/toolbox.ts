import type * as Blockly from "blockly/core";

export const activityToolbox: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "flyoutToolbox",
  contents: [
    {
      kind: "block",
      type: "activity_start",
    },
    {
      kind: "block",
      type: "activity_stop",
    },
    {
      kind: "block",
      type: "activity_action",
    },
    {
      kind: "block",
      type: "activity_if",
    },
    {
      kind: "block",
      type: "activity_while",
    },
    {
      kind: "block",
      type: "activity_repeat",
    },
    {
      kind: "block",
      type: "activity_fork",
    },
    {
      kind: "block",
      type: "activity_partition",
    },
    {
      kind: "block",
      type: "activity_swimlane",
    },
    {
      kind: "block",
      type: "activity_raw_line",
    },
  ],
};
