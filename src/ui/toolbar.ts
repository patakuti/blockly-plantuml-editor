import { exportWorkspaceJson, importWorkspaceJson } from "../workspace/persistence";
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

  const importButton = document.createElement("button");
  importButton.textContent = "Import PlantUML";
  importButton.addEventListener("click", () => {
    const active = options.getActive();
    if (!active.openImportDialog) {
      window.alert("PlantUML import is not supported for this diagram type.");
      return;
    }
    active.openImportDialog(active.workspace);
  });

  toolbar.append(saveButton, loadButton, fileInput, undoButton, clearButton, importButton);
  container.appendChild(toolbar);
}
