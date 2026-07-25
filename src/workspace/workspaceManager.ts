import * as Blockly from "blockly/core";
import { loadFromLocalStorage } from "./persistence";

export interface DiagramConfig {
  key: string;
  label: string;
  toolbox: Blockly.utils.toolbox.ToolboxInfo;
  toCode: (workspace: Blockly.Workspace) => string;
  generator: Blockly.CodeGenerator;
  jsonFilename: string;
  plantUmlFilename: string;
  /** Only run when there's no saved state to restore (e.g. activity's fixed start/stop). */
  setUpInitialState?: (workspace: Blockly.WorkspaceSvg) => void;
  /** Run on every non-UI change to refresh block warnings (e.g. FR-SEQ-07/09). */
  onValidate?: (workspace: Blockly.WorkspaceSvg) => void;
  /** Run on every field-value change, before onValidate (Round 7: FR-SEQ-13/FR-ACT-13 rename sync). */
  onFieldChange?: (workspace: Blockly.Workspace, event: Blockly.Events.BlockChange) => void;
  /**
   * Block types whose NAME field must be unique across the workspace (Round
   * 13: FR-SEQ-14/FR-STATE-10). When set, new blocks of these types are
   * auto-renamed on creation if their NAME collides with an existing one, and
   * a rename to an already-used name is rejected (reverted) instead of being
   * propagated by onFieldChange.
   */
  nameOwnerTypes?: ReadonlySet<string>;
  /**
   * Run when a block that was never seen before this session makes its
   * first-ever stack/input connection (Round 14: FR-SEQ-15/16, FR-STATE-11).
   * Absent for diagram types with no auto-default logic (activity).
   */
  autoDefaultOnConnect?: (workspace: Blockly.Workspace, block: Blockly.Block) => void;
  /**
   * Opens this diagram type's "Import PlantUML" dialog, if it has one
   * (01_requirements.md FR-IMPORT-01, 02_design.md 16.5). Absent for diagram
   * types with no importer; ui/toolbar.ts alerts in that case instead of
   * hardcoding which diagram keys support import.
   */
  openImportDialog?: (workspace: Blockly.WorkspaceSvg) => void;
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

    // `comments: true` is required for Blockly's "Add Comment" context menu item
    // and comment bubble UI to appear at all (default is disabled). Needed for
    // the Note-attachment feature (01_requirements.md FR-COM-05/FR-COM-12).
    const workspace = Blockly.inject(container, {
      toolbox: config.toolbox,
      comments: true,
      move: { drag: true, scrollbars: true, wheel: true },
    });
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
