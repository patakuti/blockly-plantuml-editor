import type { Block, CodeGenerator } from "blockly/core";
import { wrapWithNoteIfPresent } from "./noteWrapper";

/**
 * Walks a chain of statement blocks starting at `firstBlock` (following
 * next-connections) and concatenates their generated code. Used both for
 * container bodies (If/While/Fork/...) and for top-level diagram generation,
 * so a new container block type never needs its own chain-walking logic.
 */
export function generateStatements(
  generator: CodeGenerator,
  firstBlock: Block | null,
): string {
  const lines: string[] = [];
  let block = firstBlock;
  while (block) {
    if (block.isEnabled()) {
      const result = generator.blockToCode(block, true);
      const code = Array.isArray(result) ? result[0] : result;
      if (code) lines.push(wrapWithNoteIfPresent(block, code));
    }
    block = block.getNextBlock();
  }
  return lines.join("");
}
