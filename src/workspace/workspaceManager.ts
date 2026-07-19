import * as Blockly from "blockly/core";
import { loadFromLocalStorage } from "./persistence";

export interface DiagramConfig {
  key: string;
  label: string;
  toolbox: Blockly.utils.toolbox.ToolboxInfo;
  toCode: (workspace: Blockly.Workspace) => string;
  jsonFilename: string;
  plantUmlFilename: string;
  /** Only run when there's no saved state to restore (e.g. activity's fixed start/stop). */
  setUpInitialState?: (workspace: Blockly.WorkspaceSvg) => void;
}

export interface DiagramInstance extends DiagramConfig {
  workspace: Blockly.WorkspaceSvg;
  container: HTMLElement;
}

/**
 * Creates one Blockly workspace per diagram config, each in its own
 * always-mounted container (hidden via CSS rather than destroyed) so
 * switching tabs never loses in-progress edits (01_requirements.md
 * FR-COM-01, 02_design.md section 3).
 */
export function createDiagramInstances(
  host: HTMLElement,
  configs: DiagramConfig[],
): DiagramInstance[] {
  return configs.map((config) => {
    const container = document.createElement("div");
    container.className = "workspace-instance";
    container.style.display = "none";
    host.appendChild(container);

    const workspace = Blockly.inject(container, { toolbox: config.toolbox });
    const restored = loadFromLocalStorage(config.key, workspace);
    if (!restored) {
      config.setUpInitialState?.(workspace);
    }

    return { ...config, workspace, container };
  });
}

export function showDiagram(instances: DiagramInstance[], activeKey: string): void {
  for (const instance of instances) {
    const isActive = instance.key === activeKey;
    instance.container.style.display = isActive ? "block" : "none";
    if (isActive) Blockly.svgResize(instance.workspace);
  }
}
