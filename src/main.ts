import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import "./style.css";
import { defineActivityBlocks } from "./blocks/activity/blocks";
import { activityToolbox } from "./blocks/activity/toolbox";
import { activityWorkspaceToCode } from "./generators/activityGenerator";
import { defineSequenceBlocks } from "./blocks/sequence/blocks";
import { sequenceToolbox } from "./blocks/sequence/toolbox";
import { sequenceWorkspaceToCode } from "./generators/sequenceGenerator";
import { PreviewPanel } from "./preview/previewPanel";
import { saveToLocalStorage } from "./workspace/persistence";
import {
  createDiagramInstances,
  showDiagram,
  type DiagramConfig,
  type DiagramInstance,
} from "./workspace/workspaceManager";
import { createToolbar } from "./ui/toolbar";
import { createTabs } from "./ui/tabs";

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

const app = document.getElementById("app")!;

const tabsDiv = document.createElement("div");
app.appendChild(tabsDiv);

const toolbarDiv = document.createElement("div");
app.appendChild(toolbarDiv);

const layout = document.createElement("div");
layout.className = "layout";
app.appendChild(layout);

const workspaceHost = document.createElement("div");
workspaceHost.id = "blocklyDiv";
layout.appendChild(workspaceHost);

const previewDiv = document.createElement("div");
previewDiv.id = "previewDiv";
layout.appendChild(previewDiv);

Blockly.setLocale(En as unknown as Record<string, string>);

defineActivityBlocks();
defineSequenceBlocks();

const diagramConfigs: DiagramConfig[] = [
  {
    key: "activity",
    label: "Activity Diagram",
    toolbox: activityToolbox,
    toCode: activityWorkspaceToCode,
    jsonFilename: "activity-diagram.json",
    plantUmlFilename: "activity-diagram.puml",
    setUpInitialState: setUpFixedStartStop,
  },
  {
    key: "sequence",
    label: "Sequence Diagram",
    toolbox: sequenceToolbox,
    toCode: sequenceWorkspaceToCode,
    jsonFilename: "sequence-diagram.json",
    plantUmlFilename: "sequence-diagram.puml",
  },
];

const instances = createDiagramInstances(workspaceHost, diagramConfigs);
const instanceByKey = new Map(instances.map((instance) => [instance.key, instance]));

const previewPanel = new PreviewPanel(previewDiv);

let activeKey = instances[0].key;

function updatePreview(): void {
  const active = instanceByKey.get(activeKey)!;
  previewPanel.scheduleUpdate(active.toCode(active.workspace));
}

for (const instance of instances) {
  instance.workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    saveToLocalStorage(instance.key, instance.workspace);
    if (instance.key === activeKey) updatePreview();
  });
}

createTabs(
  tabsDiv,
  instances.map((instance) => ({ key: instance.key, label: instance.label })),
  (key) => {
    activeKey = key;
    showDiagram(instances, key);
    updatePreview();
  },
);

createToolbar(toolbarDiv, {
  getActive: (): DiagramInstance => instanceByKey.get(activeKey)!,
});

if (import.meta.env.DEV) {
  // Dev-only hook so workspaces can be driven from browser automation
  // during manual/E2E verification. Tree-shaken out of production builds.
  (
    window as unknown as { __diagram: { instances: DiagramInstance[]; getActiveKey: () => string } }
  ).__diagram = {
    instances,
    getActiveKey: () => activeKey,
  };
}
