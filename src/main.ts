import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import "./style.css";
import { installUnifiedBlockRangeOverrides } from "./blocks/common/blockRangeOverrides";
import { defineActivityBlocks } from "./blocks/activity/blocks";
import { activityToolbox } from "./blocks/activity/toolbox";
import { setUpFixedStartStop, enforceFixedStartStopInvariants } from "./blocks/activity/fixedStartStop";
import { activityGenerator, activityWorkspaceToCode } from "./generators/activityGenerator";
import { defineSequenceBlocks } from "./blocks/sequence/blocks";
import { sequenceToolbox } from "./blocks/sequence/toolbox";
import { sequenceGenerator, sequenceWorkspaceToCode } from "./generators/sequenceGenerator";
import { validateSequenceWorkspace } from "./blocks/sequence/validation";
import { getBlockOwnCode } from "./generators/common/blockSnippet";
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
import { installSplitter } from "./ui/splitter";

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
installUnifiedBlockRangeOverrides();

const diagramConfigs: DiagramConfig[] = [
  {
    key: "activity",
    label: "Activity Diagram",
    toolbox: activityToolbox,
    toCode: activityWorkspaceToCode,
    generator: activityGenerator,
    jsonFilename: "activity-diagram.json",
    plantUmlFilename: "activity-diagram.puml",
    setUpInitialState: setUpFixedStartStop,
    onValidate: enforceFixedStartStopInvariants,
  },
  {
    key: "sequence",
    label: "Sequence Diagram",
    toolbox: sequenceToolbox,
    toCode: sequenceWorkspaceToCode,
    generator: sequenceGenerator,
    jsonFilename: "sequence-diagram.json",
    plantUmlFilename: "sequence-diagram.puml",
    onValidate: validateSequenceWorkspace,
  },
];

const instances = createDiagramInstances(workspaceHost, diagramConfigs);
const instanceByKey = new Map(instances.map((instance) => [instance.key, instance]));

const previewPanel = new PreviewPanel(previewDiv);

let activeKey = instances[0].key;

function updatePreview(): void {
  const active = instanceByKey.get(activeKey)!;
  previewPanel.setActiveFilename(active.plantUmlFilename);
  previewPanel.scheduleUpdate(active.toCode(active.workspace));
}

for (const instance of instances) {
  instance.onValidate?.(instance.workspace);
  instance.workspace.addChangeListener((event) => {
    if (event instanceof Blockly.Events.Selected) {
      if (instance.key !== activeKey) return;
      const block = event.newElementId ? instance.workspace.getBlockById(event.newElementId) : null;
      previewPanel.highlight(block ? getBlockOwnCode(instance.generator, block) : null);
      return;
    }
    if (event.isUiEvent) return;
    saveToLocalStorage(instance.key, instance.workspace);
    instance.onValidate?.(instance.workspace);
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

installSplitter(layout, workspaceHost, previewDiv, () => {
  Blockly.svgResize(instanceByKey.get(activeKey)!.workspace);
});

createToolbar(toolbarDiv, {
  getActive: (): DiagramInstance => instanceByKey.get(activeKey)!,
  onPlantUmlServerChanged: updatePreview,
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
