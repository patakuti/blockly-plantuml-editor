import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import {
  consumeEligibility,
  forgetBlocks,
  isEligible,
  registerIneligible,
  trackBlockCreate,
} from "../../src/blocks/common/autoDefaultTracking";

defineSequenceBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("autoDefaultTracking", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockCreate) trackBlockCreate(event);
    });
  });

  it("makes a genuinely new block's ID eligible until explicitly consumed", async () => {
    const block = workspace.newBlock("sequence_message");
    await flushEvents();

    expect(isEligible(block.id)).toBe(true);
    consumeEligibility(block.id);
    expect(isEligible(block.id)).toBe(false);
  });

  it("peeking with isEligible does not consume it", async () => {
    const block = workspace.newBlock("sequence_message");
    await flushEvents();

    expect(isEligible(block.id)).toBe(true);
    expect(isEligible(block.id)).toBe(true);
  });

  it("never makes an unknown ID eligible on its own", () => {
    expect(isEligible("never-created")).toBe(false);
  });

  it("registerIneligible called before the BlockCreate event is delivered keeps the ID ineligible", async () => {
    const block = workspace.newBlock("sequence_message");
    registerIneligible([block.id]); // simulates Duplicate/import/workspace-restore marking, synchronously
    await flushEvents();

    expect(isEligible(block.id)).toBe(false);
  });

  it("a BlockCreate event replaying an already-known ID (Undo/Redo) does not become eligible", async () => {
    const block = workspace.newBlock("sequence_message");
    await flushEvents();
    // First creation consumed normally, simulating the block having already been connected once.
    expect(isEligible(block.id)).toBe(true);
    consumeEligibility(block.id);

    // Undo/Redo recreates a block under its original ID -- simulate by firing another
    // BlockCreate for the same ID directly (bypassing the async queue, since we only
    // care about trackBlockCreate's own bookkeeping here).
    trackBlockCreate(new Blockly.Events.BlockCreate(block));

    expect(isEligible(block.id)).toBe(false);
  });

  it("forgetBlocks makes a later BlockCreate reusing the same ID eligible again (02_design.md 24.11)", async () => {
    // Confirmed live: Blockly can hand a fresh toolbox-drag the exact same ID a
    // just-deleted block had, if that ID is free in the workspace. Without
    // forgetBlocks at delete time, this ID reuse would be misread as Undo/Redo
    // restoring the deleted block, permanently excluding every future block
    // that happens to reuse that ID.
    const block = workspace.newBlock("sequence_message");
    await flushEvents();
    consumeEligibility(block.id);
    expect(isEligible(block.id)).toBe(false);

    forgetBlocks([block.id]); // simulates deleteBlockAndChain right before disposing the block

    // A later, unrelated BlockCreate reusing the same ID string is treated as genuinely new.
    trackBlockCreate(new Blockly.Events.BlockCreate(block));
    expect(isEligible(block.id)).toBe(true);
  });
});
