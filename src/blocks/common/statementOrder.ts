import type * as Blockly from "blockly/core";

/**
 * Walks `firstBlock`'s next-chain, inlining each block's nested statement
 * chains (as reported by `getNestedHeads`) immediately after that block --
 * the same recursive structure `generators/common/statementGenerator.ts`'s
 * generateStatements uses to produce PlantUML text, but returning blocks
 * instead of generated code. Used to find the nearest preceding/following
 * block of a given type across Alt/Opt/Loop, Composite State, and parallel
 * region nesting (02_design.md 24.6, FR-SEQ-15/16, FR-STATE-11).
 */
export function flattenChain(
  firstBlock: Blockly.Block | null,
  getNestedHeads: (block: Blockly.Block) => (Blockly.Block | null)[],
): Blockly.Block[] {
  const result: Blockly.Block[] = [];
  let block = firstBlock;
  while (block) {
    result.push(block);
    for (const nestedHead of getNestedHeads(block)) {
      result.push(...flattenChain(nestedHead, getNestedHeads));
    }
    block = block.getNextBlock();
  }
  return result;
}
