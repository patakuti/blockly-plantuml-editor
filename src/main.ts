import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import "./style.css";
import { installUnifiedBlockRangeOverrides } from "./blocks/common/blockRangeOverrides";
import { installNoteDirectionMenu } from "./blocks/common/noteDirectionMenu";
import { defineActivityBlocks } from "./blocks/activity/blocks";
import { activityToolbox } from "./blocks/activity/toolbox";
import { validateActivityWorkspace } from "./blocks/activity/validation";
import { syncSwimlaneRename } from "./blocks/activity/renameSync";
import { activityGenerator, activityWorkspaceToCode } from "./generators/activityGenerator";
import { defineSequenceBlocks } from "./blocks/sequence/blocks";
import { sequenceToolbox } from "./blocks/sequence/toolbox";
import { sequenceGenerator, sequenceWorkspaceToCode } from "./generators/sequenceGenerator";
import { validateSequenceWorkspace } from "./blocks/sequence/validation";
import { syncParticipantRename } from "./blocks/sequence/renameSync";
import { applySequenceAutoDefault } from "./blocks/sequence/autoDefault";
import { defineStateBlocks } from "./blocks/state/blocks";
import { stateToolbox } from "./blocks/state/toolbox";
import { stateGenerator, stateWorkspaceToCode } from "./generators/stateGenerator";
import { validateStateWorkspace } from "./blocks/state/validation";
import { syncStateRename } from "./blocks/state/renameSync";
import { installStateTransitionNoteRestriction } from "./blocks/state/noteRestriction";
import { guardDuplicateRename, resolveDuplicateNamesOnCreate } from "./blocks/common/duplicateName";
import { trackBlockCreate, isEligible } from "./blocks/common/autoDefaultTracking";
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
import { openImportDialog } from "./ui/importDialog";
import { parseActivityPlantUml } from "./import/activityImportParser";
import { buildActivityWorkspace } from "./import/activityImportBuilder";
import { parseSequencePlantUml } from "./import/sequenceImportParser";
import { buildSequenceWorkspace } from "./import/sequenceImportBuilder";
import { parseStatePlantUml } from "./import/stateImportParser";
import { buildStateWorkspace } from "./import/stateImportBuilder";

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
defineStateBlocks();
installUnifiedBlockRangeOverrides();
installNoteDirectionMenu();
installStateTransitionNoteRestriction();

const diagramConfigs: DiagramConfig[] = [
  {
    key: "activity",
    label: "Activity Diagram",
    toolbox: activityToolbox,
    toCode: activityWorkspaceToCode,
    generator: activityGenerator,
    jsonFilename: "activity-diagram.json",
    plantUmlFilename: "activity-diagram.puml",
    onValidate: validateActivityWorkspace,
    onFieldChange: syncSwimlaneRename,
    openImportDialog: (workspace) =>
      openImportDialog(workspace, {
        title: "Import PlantUML (Activity Diagram)",
        hint: "Paste PlantUML activity-diagram source. Unrecognized lines are kept as Raw PlantUML Line blocks.",
        placeholder: "@startuml\nstart\n:Do something;\nstop\n@enduml",
        parse: parseActivityPlantUml,
        build: buildActivityWorkspace,
      }),
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
    onFieldChange: syncParticipantRename,
    nameOwnerTypes: new Set(["sequence_participant"]),
    autoDefaultOnConnect: applySequenceAutoDefault,
    openImportDialog: (workspace) =>
      openImportDialog(workspace, {
        title: "Import PlantUML (Sequence Diagram)",
        hint: "Paste PlantUML sequence-diagram source. Unrecognized lines are kept as Raw PlantUML Line blocks.",
        placeholder: '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": Hello\n@enduml',
        parse: parseSequencePlantUml,
        build: buildSequenceWorkspace,
      }),
  },
  {
    key: "state",
    label: "State Diagram",
    toolbox: stateToolbox,
    toCode: stateWorkspaceToCode,
    generator: stateGenerator,
    jsonFilename: "state-diagram.json",
    plantUmlFilename: "state-diagram.puml",
    onValidate: validateStateWorkspace,
    onFieldChange: syncStateRename,
    nameOwnerTypes: new Set(["state_state", "state_composite", "state_choice"]),
    openImportDialog: (workspace) =>
      openImportDialog(workspace, {
        title: "Import PlantUML (State Diagram)",
        hint: "Paste PlantUML state-diagram source. Unrecognized lines are kept as Raw PlantUML Line blocks.",
        placeholder: "@startuml\nstate State1\n[*] --> State1\nState1 --> [*]\n@enduml",
        parse: parseStatePlantUml,
        build: buildStateWorkspace,
      }),
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
    if (event instanceof Blockly.Events.BlockCreate) {
      trackBlockCreate(event);
      if (instance.nameOwnerTypes) {
        resolveDuplicateNamesOnCreate(instance.workspace, event, instance.nameOwnerTypes);
      }
    }
    if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
      const reverted = instance.nameOwnerTypes
        ? guardDuplicateRename(instance.workspace, event, instance.nameOwnerTypes)
        : false;
      if (!reverted) instance.onFieldChange?.(instance.workspace, event);
    }
    if (
      event instanceof Blockly.Events.BlockMove &&
      instance.autoDefaultOnConnect &&
      event.blockId &&
      isEligible(event.blockId)
    ) {
      const block = instance.workspace.getBlockById(event.blockId);
      if (block) instance.autoDefaultOnConnect(instance.workspace, block);
    }
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
