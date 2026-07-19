import type * as Blockly from "blockly/core";
import {
  exportPlantUmlText,
  exportWorkspaceJson,
  importWorkspaceJson,
} from "../workspace/persistence";

interface ToolbarOptions {
  workspace: Blockly.Workspace;
  jsonFilename: string;
  plantUmlFilename: string;
  getPlantUmlText: () => string;
}

export function createToolbar(container: HTMLElement, options: ToolbarOptions): void {
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save JSON";
  saveButton.addEventListener("click", () => {
    exportWorkspaceJson(options.jsonFilename, options.workspace);
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
    importWorkspaceJson(file, options.workspace).finally(() => {
      fileInput.value = "";
    });
  });
  loadButton.addEventListener("click", () => fileInput.click());

  const exportButton = document.createElement("button");
  exportButton.textContent = "Export PlantUML";
  exportButton.addEventListener("click", () => {
    exportPlantUmlText(options.plantUmlFilename, options.getPlantUmlText());
  });

  toolbar.append(saveButton, loadButton, fileInput, exportButton);
  container.appendChild(toolbar);
}
