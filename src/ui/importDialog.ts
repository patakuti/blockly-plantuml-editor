import type * as Blockly from "blockly/core";
import { PlantUmlImportError } from "../import/common/noteBlockCursor";

export interface ImportDialogConfig<T> {
  /** Dialog heading, e.g. "Import PlantUML (Activity Diagram)". */
  title: string;
  /** Explanatory text shown under the heading. */
  hint: string;
  /** Placeholder text for the paste textarea. */
  placeholder: string;
  parse: (source: string) => T[];
  build: (workspace: Blockly.Workspace, nodes: T[]) => void;
}

/**
 * Opens a paste-in-text-and-import modal for `workspace` (01_requirements.md
 * FR-IMPORT-01, 02_design.md 15.5/16.5). Parsing runs entirely before
 * anything touches `workspace`, so a bad paste just shows an error and
 * leaves the dialog open for another try (FR-IMPORT-04) -- nothing is built
 * until the whole input parses cleanly.
 *
 * Generic over the diagram's own node type so both the activity and
 * sequence importers (each with their own parse/build functions and dialog
 * copy) can share this one modal implementation (02_design.md 16.5).
 */
export function openImportDialog<T>(workspace: Blockly.WorkspaceSvg, config: ImportDialogConfig<T>): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const heading = document.createElement("h2");
  heading.textContent = config.title;

  const hint = document.createElement("p");
  hint.className = "modal-hint";
  hint.textContent = config.hint;

  const textarea = document.createElement("textarea");
  textarea.className = "modal-textarea";
  textarea.placeholder = config.placeholder;
  textarea.rows = 16;

  const errorDiv = document.createElement("div");
  errorDiv.className = "modal-error";

  const buttonRow = document.createElement("div");
  buttonRow.className = "modal-actions";

  const importButton = document.createElement("button");
  importButton.textContent = "Import";

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";

  buttonRow.append(importButton, cancelButton);
  modal.append(heading, hint, textarea, errorDiv, buttonRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  textarea.focus();

  function close(): void {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeyDown);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  cancelButton.addEventListener("click", close);

  importButton.addEventListener("click", () => {
    errorDiv.textContent = "";
    let nodes: T[];
    try {
      nodes = config.parse(textarea.value);
    } catch (error) {
      errorDiv.textContent = error instanceof PlantUmlImportError ? error.message : String(error);
      return;
    }

    if (workspace.getTopBlocks(false).length > 0) {
      if (!window.confirm("This will replace the current diagram. Continue?")) return;
    }
    config.build(workspace, nodes);
    close();
  });
}
