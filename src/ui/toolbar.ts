import {
  exportPlantUmlText,
  exportWorkspaceJson,
  importWorkspaceJson,
} from "../workspace/persistence";
import type { DiagramInstance } from "../workspace/workspaceManager";

interface ToolbarOptions {
  /** Resolved on every click so the toolbar always targets the active tab. */
  getActive: () => DiagramInstance;
}

export function createToolbar(container: HTMLElement, options: ToolbarOptions): void {
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save JSON";
  saveButton.addEventListener("click", () => {
    const active = options.getActive();
    exportWorkspaceJson(active.jsonFilename, active.workspace);
  });

  const loadButton = document.createElement("button");
  loadButton.textContent = "Load JSON";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    importWorkspaceJson(file, options.getActive().workspace).finally(() => {
      fileInput.value = "";
    });
  });
  loadButton.addEventListener("click", () => fileInput.click());

  const exportButton = document.createElement("button");
  exportButton.textContent = "Export PlantUML";
  exportButton.addEventListener("click", () => {
    const active = options.getActive();
    exportPlantUmlText(active.plantUmlFilename, active.toCode(active.workspace));
  });

  toolbar.append(saveButton, loadButton, fileInput, exportButton);
  container.appendChild(toolbar);
}
