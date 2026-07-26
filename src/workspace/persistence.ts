import * as Blockly from "blockly/core";
import { registerIneligible } from "../blocks/common/autoDefaultTracking";

const STORAGE_KEY_PREFIX = "bpe:";

/**
 * Blocks restored from a full workspace load already carry their real field
 * values (FROM/TO/TARGET included), so Round 14's auto-default must not
 * treat them as freshly-dropped blank blocks (02_design.md 24.4) -- otherwise
 * a later manual reconnect of a restored block would overwrite its restored
 * values with a neighbor-based guess.
 */
function excludeFromAutoDefault(workspace: Blockly.Workspace): void {
  registerIneligible(workspace.getAllBlocks(false).map((b) => b.id));
}

export function saveToLocalStorage(diagramType: string, workspace: Blockly.Workspace): void {
  const state = Blockly.serialization.workspaces.save(workspace);
  localStorage.setItem(STORAGE_KEY_PREFIX + diagramType, JSON.stringify(state));
}

/** Returns true if saved state was found and loaded. */
export function loadFromLocalStorage(diagramType: string, workspace: Blockly.Workspace): boolean {
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + diagramType);
  if (!raw) return false;
  Blockly.serialization.workspaces.load(JSON.parse(raw), workspace);
  excludeFromAutoDefault(workspace);
  return true;
}

export async function exportWorkspaceJson(filename: string, workspace: Blockly.Workspace): Promise<void> {
  const state = Blockly.serialization.workspaces.save(workspace);
  await saveFile(filename, JSON.stringify(state, null, 2), "application/json", [".json"]);
}

export async function importWorkspaceJson(file: File, workspace: Blockly.Workspace): Promise<void> {
  const state = JSON.parse(await file.text());
  workspace.clear();
  Blockly.serialization.workspaces.load(state, workspace);
  excludeFromAutoDefault(workspace);
}

export async function exportPlantUmlText(filename: string, plantUmlText: string): Promise<void> {
  await saveFile(filename, plantUmlText, "text/plain", [".puml", ".txt"]);
}

/**
 * Saves `content` to a file. Uses the File System Access API's native save
 * dialog when available (Chrome/Edge); falls back to the classic
 * anchor-download trick everywhere else, e.g. Firefox (01_requirements.md
 * FR-SAVE-06, 02_design.md 12.6). `content` accepts a `Blob` too, so callers
 * outside this module (e.g. preview/previewPanel.ts's SVG/PNG export,
 * 01_requirements.md FR-SAVE-08) can reuse the same picker/fallback logic.
 */
export async function saveFile(
  filename: string,
  content: string | BufferSource | Blob,
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
  downloadFile(filename, content, mimeType);
}

function downloadFile(filename: string, content: string | BufferSource | Blob, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
