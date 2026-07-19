import type { Block } from "blockly/core";
import { escapeText } from "./escape";

/**
 * Wraps generated code with a PlantUML note if the block has a Blockly
 * comment attached. Kept as a single seam so future note direction/placement
 * options only require changes here, not in every block's generator.
 */
export function wrapWithNoteIfPresent(block: Block, code: string): string {
  const comment = block.getCommentText();
  if (!comment) return code;
  return `${code}note right\n${escapeText(comment)}\nend note\n`;
}
