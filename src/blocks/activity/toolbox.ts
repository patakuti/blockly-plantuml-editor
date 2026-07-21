import type * as Blockly from "blockly/core";

/**
 * activity_start / activity_stop are intentionally excluded: they are placed
 * once as fixed, non-deletable/non-movable blocks at workspace setup time
 * (see main.ts), not offered for repeated use.
 */
export const activityToolbox: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "flyoutToolbox",
  contents: [
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
  ],
};
