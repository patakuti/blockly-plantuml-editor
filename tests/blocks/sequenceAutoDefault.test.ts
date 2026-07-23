import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { applySequenceAutoDefault } from "../../src/blocks/sequence/autoDefault";
import {
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

/**
 * Wires the same BlockCreate/BlockMove handling main.ts installs for the
 * sequence diagram (02_design.md 24.5), so tests exercise the real
 * first-connection detection instead of calling applySequenceAutoDefault
 * directly. Triggers on the first BlockMove of any kind for an eligible ID
 * (connecting into a stack, or simply settling at a standalone position) --
 * a real toolbox-drag dropped onto empty canvas fires a position-only move
 * with no parent change, confirmed live in the browser (02_design.md 24.5).
 * Only peeks eligibility (isEligible): applySequenceAutoDefault itself
 * decides whether to consumeEligibility, since an inconclusive standalone
 * drop (24.7a) must stay eligible for a later real connection.
 */
function installAutoDefaultWiring(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event instanceof Blockly.Events.BlockCreate) trackBlockCreate(event);
    if (event instanceof Blockly.Events.BlockMove && event.blockId && isEligible(event.blockId)) {
      const block = workspace.getBlockById(event.blockId);
      if (block) applySequenceAutoDefault(workspace, block);
    }
  });
}

/**
 * Simulates a plain drag-to-empty-space: a BlockMove for a block that has no
 * parent (block.getParent() is null), the same shape confirmed live in the
 * browser for a toolbox-drag dropped onto empty canvas (02_design.md 24.5).
 */
function firePositionOnlyMove(block: Blockly.Block): void {
  Blockly.Events.fire(new Blockly.Events.BlockMove(block));
}

function participant(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock("sequence_participant");
  block.setFieldValue(name, "NAME");
  return block;
}

function actor(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock("sequence_actor");
  block.setFieldValue(name, "NAME");
  return block;
}

function message(workspace: Blockly.Workspace, from: string, to: string): Blockly.Block {
  const block = workspace.newBlock("sequence_message");
  block.setFieldValue(from, "FROM");
  block.setFieldValue(to, "TO");
  return block;
}

describe("applySequenceAutoDefault (FR-SEQ-15/16)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    installAutoDefaultWiring(workspace);
  });

  it("defaults a new Message's FROM/TO to the preceding Message's recipient", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const m1 = message(workspace, "Alice", "Bob");
    await flushEvents();

    const m2 = workspace.newBlock("sequence_message");
    m1.nextConnection!.connect(m2.previousConnection!);
    await flushEvents();

    expect(m2.getFieldValue("FROM")).toBe("Bob");
    expect(m2.getFieldValue("TO")).toBe("Bob");
  });

  it("defaults a new Note's TARGET to the preceding Message's recipient", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const m1 = message(workspace, "Alice", "Bob");
    await flushEvents();

    const note = workspace.newBlock("sequence_note");
    m1.nextConnection!.connect(note.previousConnection!);
    await flushEvents();

    expect(note.getFieldValue("TARGET")).toBe("Bob");
  });

  it("finds the preceding Message across a Loop's nested body", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const before = message(workspace, "Alice", "Bob");
    const loop = workspace.newBlock("sequence_loop");
    before.nextConnection!.connect(loop.previousConnection!);
    await flushEvents();

    const inner = workspace.newBlock("sequence_message");
    loop.getInput("DO")!.connection!.connect(inner.previousConnection!);
    await flushEvents();

    expect(inner.getFieldValue("FROM")).toBe("Bob");
    expect(inner.getFieldValue("TO")).toBe("Bob");
  });

  it("finds the preceding Message across an Alt's else branch, from the branch before it", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const alt = workspace.newBlock("sequence_alt");
    (alt as unknown as { loadExtraState(state: { extraElseCount: number }): void }).loadExtraState({
      extraElseCount: 1,
    });
    const branch0 = message(workspace, "Alice", "Bob");
    // branch0 is a fixture representing an already-populated Message, not the block under
    // test -- exclude it from auto-default so connecting it into DO0 doesn't overwrite the
    // "Bob" TO value this test relies on (mirrors registerIneligible's real call sites).
    registerIneligible([branch0.id]);
    alt.getInput("DO0")!.connection!.connect(branch0.previousConnection!);
    await flushEvents();

    const branch1 = workspace.newBlock("sequence_message");
    alt.getInput("ELSE_BODY_1")!.connection!.connect(branch1.previousConnection!);
    await flushEvents();

    expect(branch1.getFieldValue("FROM")).toBe("Bob");
    expect(branch1.getFieldValue("TO")).toBe("Bob");
  });

  it("falls back to the first declared Participant when connected with no preceding Message", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const before = workspace.newBlock("sequence_note"); // not a sequence_message, so it doesn't count as "preceding"
    await flushEvents();

    const first = workspace.newBlock("sequence_message");
    before.nextConnection!.connect(first.previousConnection!);
    await flushEvents();

    expect(first.getFieldValue("FROM")).toBe("Alice");
    expect(first.getFieldValue("TO")).toBe("Alice");
  });

  it("falls back to the first declared Actor when the only declared lifeline is an Actor (FR-SEQ-17)", async () => {
    actor(workspace, "Alice");
    const before = workspace.newBlock("sequence_note");
    await flushEvents();

    const first = workspace.newBlock("sequence_message");
    before.nextConnection!.connect(first.previousConnection!);
    await flushEvents();

    expect(first.getFieldValue("FROM")).toBe("Alice");
    expect(first.getFieldValue("TO")).toBe("Alice");
  });

  it("falls back to the first declared Participant for a Message dropped standalone on empty canvas (02_design.md 24.5/24.7a)", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    await flushEvents();

    const first = workspace.newBlock("sequence_message");
    await flushEvents();
    firePositionOnlyMove(first);
    await flushEvents();

    expect(first.getFieldValue("FROM")).toBe("Alice");
    expect(first.getFieldValue("TO")).toBe("Alice");
  });

  it("stays pending (no fallback) for a standalone drop when another Message already exists elsewhere in the workspace", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const existing = message(workspace, "Alice", "Bob"); // a separate, unconnected chain
    await flushEvents();

    const orphan = workspace.newBlock("sequence_message");
    await flushEvents();
    firePositionOnlyMove(orphan);
    await flushEvents();

    // Inconclusive: not the workspace's only Message, but nothing precedes it in its own chain.
    expect(orphan.getFieldValue("FROM")).toBe("");
    expect(orphan.getFieldValue("TO")).toBe("");
    expect(isEligible(orphan.id)).toBe(true);
    expect(existing.getFieldValue("TO")).toBe("Bob"); // untouched
  });

  it("resolves correctly once a previously-pending orphan actually connects to the real chain", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const existing = message(workspace, "Alice", "Bob");
    await flushEvents();

    const orphan = workspace.newBlock("sequence_message");
    await flushEvents();
    firePositionOnlyMove(orphan); // dropped standalone first; stays pending (previous test)
    await flushEvents();

    existing.nextConnection!.connect(orphan.previousConnection!);
    await flushEvents();

    expect(orphan.getFieldValue("FROM")).toBe("Bob");
    expect(orphan.getFieldValue("TO")).toBe("Bob");
    expect(isEligible(orphan.id)).toBe(false);
  });

  it("leaves FROM/TO untouched when there are no Participants at all (unchanged behavior)", async () => {
    const first = workspace.newBlock("sequence_message");
    await flushEvents();
    firePositionOnlyMove(first);
    await flushEvents();

    expect(first.getFieldValue("FROM")).toBe("");
    expect(first.getFieldValue("TO")).toBe("");
  });

  it("a Duplicate-simulated Message (pre-registered ineligible) keeps its copied values on reconnect", async () => {
    participant(workspace, "Alice");
    participant(workspace, "Bob");
    const m1 = message(workspace, "Alice", "Bob");
    await flushEvents();

    // Simulate blockRangeOverrides.ts's duplicateBlockAndChain: the duplicate already
    // carries the source's field values and is registered ineligible before its
    // BlockCreate event is delivered.
    const dup = workspace.newBlock("sequence_message");
    dup.setFieldValue("Bob", "FROM");
    dup.setFieldValue("Alice", "TO");
    registerIneligible([dup.id]);
    await flushEvents();

    // User later drags the (previously disconnected) duplicate to connect it after m1.
    m1.nextConnection!.connect(dup.previousConnection!);
    await flushEvents();

    expect(dup.getFieldValue("FROM")).toBe("Bob");
    expect(dup.getFieldValue("TO")).toBe("Alice");
  });

  it("a fresh block reusing a deleted block's ID (confirmed live: Blockly can do this on toolbox re-drag) still gets auto-defaulted (02_design.md 24.11)", async () => {
    participant(workspace, "Alice");
    await flushEvents();

    const m1 = workspace.newBlock("sequence_message");
    await flushEvents();
    firePositionOnlyMove(m1); // dropped standalone, only Participant exists -> gets the Alice/Alice fallback
    await flushEvents();
    expect(m1.getFieldValue("FROM")).toBe("Alice");

    const reusedId = m1.id;
    forgetBlocks([reusedId]); // simulates deleteBlockAndChain right before disposing m1
    m1.dispose(false);
    await flushEvents();

    // A brand new block that happens to be handed the exact same ID string.
    const m2 = workspace.newBlock("sequence_message", reusedId);
    await flushEvents();
    firePositionOnlyMove(m2);
    await flushEvents();

    expect(m2.getFieldValue("FROM")).toBe("Alice");
    expect(m2.getFieldValue("TO")).toBe("Alice");
  });
});
