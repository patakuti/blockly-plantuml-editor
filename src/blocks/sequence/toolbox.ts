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
      type: "sequence_actor",
    },
    {
      kind: "block",
      type: "sequence_message",
    },
    {
      kind: "block",
      type: "sequence_alt",
    },
    {
      kind: "block",
      type: "sequence_opt",
    },
    {
      kind: "block",
      type: "sequence_loop",
    },
    {
      kind: "block",
      type: "sequence_note",
    },
    {
      kind: "block",
      type: "sequence_activate",
    },
    {
      kind: "block",
      type: "sequence_deactivate",
    },
    {
      kind: "block",
      type: "sequence_raw_line",
    },
  ],
};
