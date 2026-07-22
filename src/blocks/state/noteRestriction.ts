import * as Blockly from "blockly/core";

/**
 * Blockly's built-in "Add Comment" / "Remove Comment" context menu item is
 * registered under this id (confirmed by reading blockly_compressed.js,
 * since it isn't part of the public .d.ts surface).
 */
const COMMENT_MENU_ITEM_ID = "blockComment";

/**
 * Hides "Add Comment" on state_transition blocks. Notes on Transitions have
 * no reliable PlantUML representation: verified against the public server
 * (2026-07-22) that the implicit `note right`/`note left` form (used for
 * every other block in this app) can render as "Nothing to note to" when
 * placed right after certain transitions (02_design.md 18.1/18.5), and a
 * transition has no natural name to target with the explicit `note X of
 * <name>` form used for State/Composite State instead. Rather than let users
 * attach a comment that silently produces broken PlantUML, the menu item
 * that would let them do so is hidden for this block type.
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
      scope.block?.type === "state_transition" ? "hidden" : originalPrecondition(scope, menuOpenEvent),
  });
}
