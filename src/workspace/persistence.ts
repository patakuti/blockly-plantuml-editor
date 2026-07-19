import * as Blockly from "blockly/core";

const STORAGE_KEY_PREFIX = "bpe:";

export function saveToLocalStorage(diagramType: string, workspace: Blockly.Workspace): void {
  const state = Blockly.serialization.workspaces.save(workspace);
  localStorage.setItem(STORAGE_KEY_PREFIX + diagramType, JSON.stringify(state));
}

/** Returns true if saved state was found and loaded. */
export function loadFromLocalStorage(diagramType: string, workspace: Blockly.Workspace): boolean {
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + diagramType);
  if (!raw) return false;
  Blockly.serialization.workspaces.load(JSON.parse(raw), workspace);
  return true;
}

export function exportWorkspaceJson(filename: string, workspace: Blockly.Workspace): void {
  const state = Blockly.serialization.workspaces.save(workspace);
  downloadTextFile(filename, JSON.stringify(state, null, 2), "application/json");
}

export async function importWorkspaceJson(file: File, workspace: Blockly.Workspace): Promise<void> {
  const state = JSON.parse(await file.text());
  workspace.clear();
  Blockly.serialization.workspaces.load(state, workspace);
}

export function exportPlantUmlText(filename: string, plantUmlText: string): void {
  downloadTextFile(filename, plantUmlText, "text/plain");
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
