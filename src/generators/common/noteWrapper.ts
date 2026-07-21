import type { Block } from "blockly/core";
import { escapeText } from "./escape";

export type NoteDirection = "left" | "right";

const DEFAULT_DIRECTION: NoteDirection = "right";

/** Reads the note direction stored on `block` (01_requirements.md FR-COM-12), defaulting to "right". */
export function getNoteDirection(block: Block): NoteDirection {
  return block.data === "left" ? "left" : DEFAULT_DIRECTION;
}

/** Persists the note direction on `block` via Blockly's standard `data` string (round-trips through save/load). */
export function setNoteDirection(block: Block, direction: NoteDirection): void {
  block.data = direction === DEFAULT_DIRECTION ? null : direction;
}

/**
 * Wraps generated code with a PlantUML note if the block has a Blockly
 * comment attached. Kept as a single seam so future note direction/placement
 * options only require changes here, not in every block's generator.
 */
export function wrapWithNoteIfPresent(block: Block, code: string): string {
  const comment = block.getCommentText();
  if (!comment) return code;
  return `${code}note ${getNoteDirection(block)}\n${escapeText(comment)}\nend note\n`;
}
