export interface RenameScopeDialogOptions {
  /** The name before the edit that just committed. */
  oldName: string;
  /** The name after the edit that just committed. */
  newName: string;
  /** How many other blocks currently still carry `oldName`. */
  otherCount: number;
}

/**
 * Asks whether a rename that just happened on one block should also be
 * applied to the other blocks that still carry the old name
 * (01_requirements.md FR-ACT-13, 02_design.md 17.3). Reuses the
 * `.modal-overlay`/`.modal`/`.modal-actions` styling from ui/importDialog.ts.
 *
 * The edit itself has already been committed to the block that triggered
 * this (Blockly's FieldTextInput commits on blur, before this can run) --
 * this dialog only decides whether to propagate it further. Dismissing via
 * overlay click or Escape resolves to "this", the safe no-further-changes
 * default.
 */
export function openRenameScopeDialog(options: RenameScopeDialogOptions): Promise<"this" | "all"> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";

    const heading = document.createElement("h2");
    heading.textContent = `Renamed "${options.oldName}" to "${options.newName}"`;

    const hint = document.createElement("p");
    hint.className = "modal-hint";
    hint.textContent = `${options.otherCount} other block(s) still named "${options.oldName}" were found. Apply this rename to them too?`;

    const buttonRow = document.createElement("div");
    buttonRow.className = "modal-actions";

    const thisOnlyButton = document.createElement("button");
    thisOnlyButton.textContent = "Change only this block";

    const allButton = document.createElement("button");
    allButton.textContent = `Change all ${options.otherCount + 1} blocks named "${options.newName}"`;

    buttonRow.append(thisOnlyButton, allButton);
    modal.append(heading, hint, buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(scope: "this" | "all"): void {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(scope);
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") close("this");
    }
    document.addEventListener("keydown", onKeyDown);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close("this");
    });
    thisOnlyButton.addEventListener("click", () => close("this"));
    allButton.addEventListener("click", () => close("all"));
  });
}
