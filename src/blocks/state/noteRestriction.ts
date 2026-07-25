import * as Blockly from "blockly/core";

/**
 * Blockly's built-in "Add Comment" / "Remove Comment" context menu item is
 * registered under this id (confirmed by reading blockly_compressed.js,
 * since it isn't part of the public .d.ts surface).
 */
const COMMENT_MENU_ITEM_ID = "blockComment";

/** Block types with no natural name of their own to anchor a note to (see doc comment below). */
const NOTE_RESTRICTED_TYPES = new Set(["state_transition", "state_description"]);

/**
 * Hides "Add Comment" on state_transition and state_description blocks (Round
 * 32: state_description added, same reasoning). Notes on these have no
 * reliable PlantUML representation: verified against the public server
 * (2026-07-22) that the implicit `note right`/`note left` form (used for
 * every other block in this app) can render as "Nothing to note to" when
 * placed right after certain transitions (02_design.md 18.1/18.5), and
 * neither block type has a natural name to target with the explicit `note X
 * of <name>` form used for State/Composite State instead (stateGenerator.ts's
 * stateNoteAnchor() returns undefined for both). Rather than let users attach
 * a comment that silently produces broken PlantUML, the menu item that would
 * let them do so is hidden for these block types.
 */
export function installStateTransitionNoteRestriction(): void {
  const registry = Blockly.ContextMenuRegistry.registry;
  const existing = registry.getItem(COMMENT_MENU_ITEM_ID);
  if (!existing || existing.separator) return;
  const originalPrecondition = existing.preconditionFn;
  registry.unregister(COMMENT_MENU_ITEM_ID);
  registry.register({
    ...existing,
    preconditionFn: (scope, menuOpenEvent) =>
      scope.block && NOTE_RESTRICTED_TYPES.has(scope.block.type) ? "hidden" : originalPrecondition(scope, menuOpenEvent),
  });
}
