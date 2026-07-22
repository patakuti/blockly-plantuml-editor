import * as Blockly from "blockly/core";

/**
 * Sets a block field's value, forcing a dynamic FieldDropdown to rebuild its
 * cached option list first. Blockly's FieldDropdown caches getOptions(true)
 * in `generatedOptions` and only rebuilds it on getOptions(false);
 * doValueUpdate_ (called from setFieldValue) looks up the new value in that
 * *cached* list to pick the displayed text (getText_ -> this.selectedOption).
 * A rename-sync caller (blocks/sequence/renameSync.ts,
 * blocks/activity/renameSync.ts) sets a dynamic dropdown field to a value
 * that didn't exist in its options the last time they were computed (e.g.
 * the block was rendered before the referenced participant/swimlane was
 * renamed), so without this the underlying value updates correctly (and
 * PlantUML generation, which reads getValue(), reflects it) but the block's
 * on-screen label keeps showing the stale text (confirmed by reading
 * FieldDropdown.doValueUpdate_/getOptions/getText_ in
 * node_modules/blockly/blockly_compressed.js, not by guessing). Calling
 * getOptions(false) is a no-op (aside from the refresh) for anything other
 * than a dynamic-menu FieldDropdown, so it's safe to route every
 * reference-field update in the rename-sync modules through this helper.
 */
export function setFieldValueRefreshingDropdown(block: Blockly.Block, fieldName: string, value: string): void {
  const field = block.getField(fieldName);
  if (field instanceof Blockly.FieldDropdown) field.getOptions(false);
  block.setFieldValue(value, fieldName);
}
