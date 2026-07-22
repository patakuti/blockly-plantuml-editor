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
 *
 * `anchor`, when given, targets the note explicitly (`note X of <anchor>`)
 * instead of relying on PlantUML's "attach to whatever came before" implicit
 * form. State diagrams need this: verified against the public PlantUML
 * server (2026-07-22) that the implicit form breaks in some positions (e.g.
 * right after a `[*] --> X` transition), while the explicit `of <anchor>`
 * form is robust regardless of position (02_design.md 18.1/18.5). Activity
 * and sequence diagrams don't pass `anchor` and keep the original implicit
 * form unchanged.
 */
export function wrapWithNoteIfPresent(block: Block, code: string, anchor?: string): string {
  const comment = block.getCommentText();
  if (!comment) return code;
  const target = anchor ? ` of ${anchor}` : "";
  return `${code}note ${getNoteDirection(block)}${target}\n${escapeText(comment)}\nend note\n`;
}
