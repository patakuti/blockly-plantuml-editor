import * as Blockly from "blockly";
import "./style.css";

const app = document.getElementById("app")!;
const blocklyDiv = document.createElement("div");
blocklyDiv.id = "blocklyDiv";
app.appendChild(blocklyDiv);

Blockly.inject(blocklyDiv, {
  toolbox: { kind: "flyoutToolbox", contents: [] },
});
