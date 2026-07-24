import type * as Blockly from "blockly/core";

export const componentToolbox: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "flyoutToolbox",
  contents: [
    {
      kind: "block",
      type: "component_component",
    },
    {
      kind: "block",
      type: "component_style",
    },
    {
      kind: "block",
      type: "component_dependency",
    },
    {
      kind: "block",
      type: "component_raw_line",
    },
  ],
};
