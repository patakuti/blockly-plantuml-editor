import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import "./style.css";
import { defineActivityBlocks } from "./blocks/activity/blocks";
import { activityToolbox } from "./blocks/activity/toolbox";
import { activityWorkspaceToCode } from "./generators/activityGenerator";
import { PreviewPanel } from "./preview/previewPanel";
import { loadFromLocalStorage, saveToLocalStorage } from "./workspace/persistence";
import { createToolbar } from "./ui/toolbar";

const ACTIVITY_STORAGE_KEY = "activity";

const app = document.getElementById("app")!;

const toolbarDiv = document.createElement("div");
app.appendChild(toolbarDiv);

const layout = document.createElement("div");
layout.className = "layout";
app.appendChild(layout);

const workspaceDiv = document.createElement("div");
workspaceDiv.id = "blocklyDiv";
layout.appendChild(workspaceDiv);

const previewDiv = document.createElement("div");
previewDiv.id = "previewDiv";
layout.appendChild(previewDiv);

Blockly.setLocale(En as unknown as Record<string, string>);

defineActivityBlocks();

const workspace = Blockly.inject(workspaceDiv, {
  toolbox: activityToolbox,
});

/** Places the single, fixed start/stop pair that every activity diagram starts with. */
function setUpFixedStartStop(ws: Blockly.WorkspaceSvg): void {
  const startBlock = ws.newBlock("activity_start") as Blockly.BlockSvg;
  startBlock.initSvg();
  startBlock.render();
  startBlock.moveBy(40, 40);
  startBlock.setDeletable(false);
  startBlock.setMovable(false);

  const stopBlock = ws.newBlock("activity_stop") as Blockly.BlockSvg;
  stopBlock.initSvg();
  stopBlock.render();
  stopBlock.setDeletable(false);
  stopBlock.setMovable(false);

  const startConnection = startBlock.nextConnection;
  const stopConnection = stopBlock.previousConnection;
  if (startConnection && stopConnection) {
    startConnection.connect(stopConnection);
  }
}

const restored = loadFromLocalStorage(ACTIVITY_STORAGE_KEY, workspace);
if (!restored) {
  setUpFixedStartStop(workspace);
}

const previewPanel = new PreviewPanel(previewDiv);

function updatePreview(): void {
  const code = activityWorkspaceToCode(workspace);
  previewPanel.scheduleUpdate(code);
}

workspace.addChangeListener((event) => {
  if (event.isUiEvent) return;
  updatePreview();
  saveToLocalStorage(ACTIVITY_STORAGE_KEY, workspace);
});

updatePreview();

createToolbar(toolbarDiv, {
  workspace,
  jsonFilename: "activity-diagram.json",
  plantUmlFilename: "activity-diagram.puml",
  getPlantUmlText: () => activityWorkspaceToCode(workspace),
});

if (import.meta.env.DEV) {
  // Dev-only hook so the workspace can be driven from browser automation
  // during manual/E2E verification. Tree-shaken out of production builds.
  (window as unknown as { __workspace: Blockly.WorkspaceSvg }).__workspace = workspace;
}
