import * as Blockly from "blockly/core";
import { flattenChain } from "../common/statementOrder";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";
import { consumeEligibility } from "../common/autoDefaultTracking";

function componentNestedHeads(block: Blockly.Block): (Blockly.Block | null)[] {
  return block.type === "component_component" ? [block.getInputTargetBlock("DO")] : [];
}

function isNameable(block: Blockly.Block): boolean {
  return block.type === "component_component";
}

/**
 * component_dependency's FROM/TO have no stable fallback value like
 * state_transition's "[*]" (with zero components declared, componentOptions()
 * returns [["(no components)", ""]]). So unlike applyStateAutoDefault, a side
 * that finds no match is left at its current value rather than falling back
 * to anything -- same "no fallback, stay unresolved" design as
 * sequence/autoDefault.ts's Activate/Deactivate handling (02_design.md 29.3).
 */
export function applyComponentAutoDefault(_workspace: Blockly.Workspace, block: Blockly.Block): void {
  if (block.type !== "component_dependency") return;
  if (block.getPreviousBlock() === null && block.getNextBlock() === null) return; // standalone; stay pending

  const ordered = flattenChain(block.getRootBlock(), componentNestedHeads);
  const index = ordered.indexOf(block);

  for (let i = index - 1; i >= 0; i--) {
    if (isNameable(ordered[i])) {
      setFieldValueRefreshingDropdown(block, "FROM", ordered[i].getFieldValue("NAME") as string);
      break;
    }
  }
  for (let i = index + 1; i < ordered.length; i++) {
    if (isNameable(ordered[i])) {
      setFieldValueRefreshingDropdown(block, "TO", ordered[i].getFieldValue("NAME") as string);
      break;
    }
  }
  consumeEligibility(block.id);
}
