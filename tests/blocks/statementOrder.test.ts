import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { flattenChain } from "../../src/blocks/common/statementOrder";

defineSequenceBlocks();

function sequenceNestedHeads(block: Blockly.Block): (Blockly.Block | null)[] {
  if (block.type === "sequence_alt") {
    const heads = [block.getInputTargetBlock("DO0")];
    for (let i = 1; block.getInput(`ELSE_BODY_${i}`); i++) {
      heads.push(block.getInputTargetBlock(`ELSE_BODY_${i}`));
    }
    return heads;
  }
  if (block.type === "sequence_opt" || block.type === "sequence_loop") {
    return [block.getInputTargetBlock("DO")];
  }
  return [];
}

function newMessage(workspace: Blockly.Workspace, from: string, to: string): Blockly.Block {
  const block = workspace.newBlock("sequence_message");
  block.setFieldValue(from, "FROM");
  block.setFieldValue(to, "TO");
  return block;
}

describe("flattenChain", () => {
  it("returns an empty list for a null head", () => {
    expect(flattenChain(null, sequenceNestedHeads)).toEqual([]);
  });

  it("walks a flat chain in order", () => {
    const workspace = new Blockly.Workspace();
    const m1 = newMessage(workspace, "A", "B");
    const m2 = newMessage(workspace, "B", "A");
    m1.nextConnection!.connect(m2.previousConnection!);

    expect(flattenChain(m1, sequenceNestedHeads)).toEqual([m1, m2]);
  });

  it("inlines a Loop's nested body between the blocks before and after it", () => {
    const workspace = new Blockly.Workspace();
    const before = newMessage(workspace, "A", "B");
    const loop = workspace.newBlock("sequence_loop");
    const inner = newMessage(workspace, "B", "C");
    const after = newMessage(workspace, "C", "A");

    before.nextConnection!.connect(loop.previousConnection!);
    loop.nextConnection!.connect(after.previousConnection!);
    loop.getInput("DO")!.connection!.connect(inner.previousConnection!);

    expect(flattenChain(before, sequenceNestedHeads)).toEqual([before, loop, inner, after]);
  });

  it("inlines every branch of an Alt (DO0 + each ELSE_BODY) in order", () => {
    const workspace = new Blockly.Workspace();
    const alt = workspace.newBlock("sequence_alt");
    (alt as unknown as { loadExtraState(state: { extraElseCount: number }): void }).loadExtraState({
      extraElseCount: 1,
    });

    const branch0 = newMessage(workspace, "A", "B");
    const branch1 = newMessage(workspace, "B", "A");
    alt.getInput("DO0")!.connection!.connect(branch0.previousConnection!);
    alt.getInput("ELSE_BODY_1")!.connection!.connect(branch1.previousConnection!);

    expect(flattenChain(alt, sequenceNestedHeads)).toEqual([alt, branch0, branch1]);
  });
});
