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
    // Mirrors main.ts's shared change listener (02_design.md 26.3c): BlockDelete is handled
    // generically here, not by each individual deletion code path, so it covers every way a
    // block can be removed (right-click/keyboard delete, dragging onto the toolbox, and every
    // workspace.clear() call site) with a single mechanism.
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockCreate) trackBlockCreate(event);
      if (event instanceof Blockly.Events.BlockDelete) forgetBlocks(event.ids ?? []);
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

  it("a real block.dispose() makes a later BlockCreate reusing the same ID eligible again (02_design.md 24.11/26.3c)", async () => {
    // Confirmed live: Blockly can hand a fresh toolbox-drag the exact same ID a
    // just-deleted block had, if that ID is free in the workspace. Without
    // forgetBlocks reacting to the resulting BlockDelete, this ID reuse would be
    // misread as Undo/Redo restoring the deleted block, permanently excluding
    // every future block that happens to reuse that ID.
    //
    // Deliberately calls block.dispose() directly rather than going through
    // deleteBlockAndChain (blocks/common/blockRangeOverrides.ts): this is the
    // same underlying call Blockly's own drag-to-toolbox delete gesture makes,
    // which never passes through deleteBlockAndChain at all (02_design.md
    // 26.3c) -- so the fix has to work generically off the BlockDelete event,
    // not off a specific deletion code path.
    const block = workspace.newBlock("sequence_message");
    await flushEvents();
    consumeEligibility(block.id);
    expect(isEligible(block.id)).toBe(false);

    const blockId = block.id;
    block.dispose(false);
    await flushEvents();

    // A later, unrelated BlockCreate reusing the same ID string is treated as genuinely new.
    const fresh = workspace.newBlock("sequence_message", blockId);
    await flushEvents();
    expect(isEligible(fresh.id)).toBe(true);
  });

  it("workspace.clear() forgets every block via its own individual BlockDelete events, making reused IDs eligible again", async () => {
    // Regression test: the toolbar's Clear button, PlantUML import, and JSON import all
    // discard every block via workspace.clear() directly. Unlike a single block's delete,
    // clear() disposes each top-level block separately, firing one BlockDelete per block --
    // confirmed this still reaches the same generic handler, so no dedicated call site is
    // needed for Clear/import to also forget their blocks (02_design.md 26.3b was an earlier,
    // narrower per-call-site fix; 26.3c replaces it with this single generic mechanism).
    const block = workspace.newBlock("sequence_message");
    await flushEvents();
    consumeEligibility(block.id);
    expect(isEligible(block.id)).toBe(false);

    const blockId = block.id;
    workspace.clear();
    await flushEvents();

    const fresh = workspace.newBlock("sequence_message", blockId);
    await flushEvents();
    expect(isEligible(fresh.id)).toBe(true);
  });

  it("without a BlockDelete listener, a reused ID stays permanently ineligible", async () => {
    // Same scenario as above but with a workspace that never wires forgetBlocks to
    // BlockDelete, to document the bug this design guards against.
    const bareWorkspace = new Blockly.Workspace();
    bareWorkspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockCreate) trackBlockCreate(event);
    });

    const block = bareWorkspace.newBlock("sequence_message");
    await flushEvents();
    consumeEligibility(block.id);

    const blockId = block.id;
    block.dispose(false);
    await flushEvents();

    const fresh = bareWorkspace.newBlock("sequence_message", blockId);
    await flushEvents();
    expect(isEligible(fresh.id)).toBe(false);
  });
});
