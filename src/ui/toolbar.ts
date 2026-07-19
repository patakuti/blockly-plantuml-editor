import {
  exportPlantUmlText,
  exportWorkspaceJson,
  importWorkspaceJson,
} from "../workspace/persistence";
import { getPlantUmlServerBase, setPlantUmlServerBase } from "../preview/plantumlEncoder";
import type { DiagramInstance } from "../workspace/workspaceManager";

interface ToolbarOptions {
  /** Resolved on every click so the toolbar always targets the active tab. */
  getActive: () => DiagramInstance;
  /** Called after the PlantUML server URL changes, so the preview can refresh immediately. */
  onPlantUmlServerChanged: () => void;
}

export function createToolbar(container: HTMLElement, options: ToolbarOptions): void {
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save JSON";
  saveButton.addEventListener("click", () => {
    const active = options.getActive();
    void exportWorkspaceJson(active.jsonFilename, active.workspace);
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
    void exportPlantUmlText(active.plantUmlFilename, active.toCode(active.workspace));
  });

  const undoButton = document.createElement("button");
  undoButton.textContent = "Undo";
  undoButton.addEventListener("click", () => {
    options.getActive().workspace.undo(false);
  });

  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";
  clearButton.addEventListener("click", () => {
    if (!window.confirm("Clear the current diagram?")) return;
    const active = options.getActive();
    active.workspace.clear();
    active.setUpInitialState?.(active.workspace);
  });

  const serverButton = document.createElement("button");
  serverButton.textContent = "PlantUML Server";
  serverButton.addEventListener("click", () => {
    const input = window.prompt("PlantUML server URL:", getPlantUmlServerBase());
    if (input === null) return;
    setPlantUmlServerBase(input);
    options.onPlantUmlServerChanged();
  });

  toolbar.append(saveButton, loadButton, fileInput, exportButton, undoButton, clearButton, serverButton);
  container.appendChild(toolbar);
}
