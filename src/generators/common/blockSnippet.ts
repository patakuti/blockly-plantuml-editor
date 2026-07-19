import type { Block, CodeGenerator } from "blockly/core";

/**
 * Returns just the given block's own generated code (children included for
 * container blocks, since their forBlock handler calls generateStatements()
 * internally) -- used to find and highlight the matching region of the full
 * PlantUML source when a block is selected (FR-SEQ-08's fallback: preview
 * SVGs from the public PlantUML server carry no per-element source mapping,
 * so exact-element highlighting isn't possible; highlighting the
 * corresponding source text is the documented alternative from
 * 02_design.md section 7).
 */
export function getBlockOwnCode(generator: CodeGenerator, block: Block): string | null {
  const handler = generator.forBlock[block.type];
  if (!handler) return null;
  const result = handler(block, generator);
  const code = Array.isArray(result) ? result[0] : result;
  return code || null;
}
