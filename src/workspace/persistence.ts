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

export async function exportWorkspaceJson(filename: string, workspace: Blockly.Workspace): Promise<void> {
  const state = Blockly.serialization.workspaces.save(workspace);
  await saveTextFile(filename, JSON.stringify(state, null, 2), "application/json", [".json"]);
}

export async function importWorkspaceJson(file: File, workspace: Blockly.Workspace): Promise<void> {
  const state = JSON.parse(await file.text());
  workspace.clear();
  Blockly.serialization.workspaces.load(state, workspace);
}

export async function exportPlantUmlText(filename: string, plantUmlText: string): Promise<void> {
  await saveTextFile(filename, plantUmlText, "text/plain", [".puml", ".txt"]);
}

/**
 * Saves `content` to a file. Uses the File System Access API's native save
 * dialog when available (Chrome/Edge); falls back to the classic
 * anchor-download trick everywhere else, e.g. Firefox (01_requirements.md
 * FR-SAVE-06, 02_design.md 12.6).
 */
async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string,
  extensions: string[],
): Promise<void> {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ accept: { [mimeType]: extensions } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // user cancelled the dialog
      throw error;
    }
  }
  downloadTextFile(filename, content, mimeType);
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
