import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import { applyStateAutoDefault } from "../../src/blocks/state/autoDefault";
import {
  isEligible,
  registerIneligible,
  trackBlockCreate,
} from "../../src/blocks/common/autoDefaultTracking";

defineStateBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Wires the same BlockCreate/BlockMove handling main.ts installs for the state diagram (02_design.md 24.5). */
function installAutoDefaultWiring(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event instanceof Blockly.Events.BlockCreate) trackBlockCreate(event);
    if (event instanceof Blockly.Events.BlockMove && event.blockId && isEligible(event.blockId)) {
      const block = workspace.getBlockById(event.blockId);
      if (block) applyStateAutoDefault(workspace, block);
    }
  });
}

function firePositionOnlyMove(block: Blockly.Block): void {
  Blockly.Events.fire(new Blockly.Events.BlockMove(block));
}

function state(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock("state_state");
  block.setFieldValue(name, "NAME");
  return block;
}

describe("applyStateAutoDefault (FR-STATE-11)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    installAutoDefaultWiring(workspace);
  });

  it("defaults FROM to the preceding State and TO to the following State (inserted between two already-connected States)", async () => {
    const before = state(workspace, "Idle");
    const after = state(workspace, "Done");
    const transition = workspace.newBlock("state_transition");
    // Both connections established synchronously, matching how a real drag-and-drop
    // insertion between two already-connected blocks resolves before any event is
    // delivered (Blockly's event queue is asynchronous, 17.3a/23.7).
    before.nextConnection!.connect(transition.previousConnection!);
    transition.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Idle");
    expect(transition.getFieldValue("TO")).toBe("Done");
  });

  it("leaves TO at [*] when built incrementally (Transition connected before the following State exists yet)", async () => {
    // Known limitation (02_design.md 24.13): FROM/TO are only ever evaluated once, at
    // this Transition's own first connection. Connecting a State after it later is a
    // separate event for that State, not this Transition, so TO is never retroactively
    // filled in -- consistent with the "no retroactive re-evaluation" principle already
    // established for Message/Note (24.7).
    const before = state(workspace, "Idle");
    const transition = workspace.newBlock("state_transition");
    before.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    const after = state(workspace, "Done");
    transition.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Idle");
    expect(transition.getFieldValue("TO")).toBe("[*]");
  });

  it("leaves FROM/TO at the [*] fallback when nothing precedes/follows", async () => {
    const transition = workspace.newBlock("state_transition");
    await flushEvents();
    firePositionOnlyMove(transition);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("[*]");
    expect(transition.getFieldValue("TO")).toBe("[*]");
  });

  it("sets only FROM when nothing follows, leaving TO at [*]", async () => {
    const before = state(workspace, "Idle");
    const transition = workspace.newBlock("state_transition");
    before.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Idle");
    expect(transition.getFieldValue("TO")).toBe("[*]");
  });

  it("defaults FROM to the enclosing Composite State's own name when it's the first statement in DO", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    const before = state(workspace, "Idle");
    const after = state(workspace, "Done");
    before.nextConnection!.connect(composite.previousConnection!);
    composite.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    const inner = workspace.newBlock("state_transition");
    composite.getInput("DO")!.connection!.connect(inner.previousConnection!);
    await flushEvents();

    // In PlantUML output order the Composite State itself is emitted right before its own
    // DO body, so it (not the sibling "Idle" before the whole Composite State) is the
    // nearest nameable predecessor. Forward search still finds "Done" past the Composite
    // State's end, since nothing follows inside DO.
    expect(inner.getFieldValue("FROM")).toBe("Working");
    expect(inner.getFieldValue("TO")).toBe("Done");
  });

  it("finds a preceding State within the same Composite State's DO body, not the outer chain", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    const outerBefore = state(workspace, "Idle");
    outerBefore.nextConnection!.connect(composite.previousConnection!);
    await flushEvents();

    const innerBefore = state(workspace, "Sub1");
    composite.getInput("DO")!.connection!.connect(innerBefore.previousConnection!);
    await flushEvents();

    const inner = workspace.newBlock("state_transition");
    innerBefore.nextConnection!.connect(inner.previousConnection!);
    await flushEvents();

    expect(inner.getFieldValue("FROM")).toBe("Sub1");
  });

  it("finds States across a parallel region boundary (Composite State with 2 regions)", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    (composite as unknown as { loadExtraState(state: { extraRegionCount: number }): void }).loadExtraState({
      extraRegionCount: 1,
    });
    const region0State = state(workspace, "A");
    composite.getInput("DO")!.connection!.connect(region0State.previousConnection!);
    await flushEvents();

    const region1Transition = workspace.newBlock("state_transition");
    composite.getInput("REGION1")!.connection!.connect(region1Transition.previousConnection!);
    await flushEvents();

    // Backward search crosses from REGION1 back into DO's "A" (a parallel-region quirk
    // documented as a known limitation, 01_requirements.md 4.12).
    expect(region1Transition.getFieldValue("FROM")).toBe("A");
  });

  it("leaves a standalone Transition untouched even when unrelated States exist in a different top-level chain", async () => {
    const before = state(workspace, "Idle");
    const after = state(workspace, "Done");
    before.nextConnection!.connect(after.previousConnection!); // one fully-formed, separate top-level chain
    await flushEvents();

    // A brand new standalone Transition, positioned as its own separate top-level entry --
    // not connected to the Idle/Done chain at all. State diagrams have no single main chain
    // (18.4/stateWorkspaceToCode), so without the "must actually be connected" guard
    // (02_design.md 24.12), this would spuriously pick up "Done" as FROM even though the
    // two are unrelated (confirmed live in the browser).
    const transition = workspace.newBlock("state_transition");
    await flushEvents();
    firePositionOnlyMove(transition);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("[*]");
    expect(transition.getFieldValue("TO")).toBe("[*]");
    expect(isEligible(transition.id)).toBe(true); // stays pending for a later real connection
  });

  it("resolves correctly once a previously-standalone Transition actually connects", async () => {
    const before = state(workspace, "Idle");
    state(workspace, "Done"); // an unrelated separate top-level chain

    const transition = workspace.newBlock("state_transition");
    await flushEvents();
    firePositionOnlyMove(transition); // dropped standalone first; stays pending (previous test)
    await flushEvents();

    before.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Idle");
    expect(isEligible(transition.id)).toBe(false);
  });

  it("connecting a Transition to the head of one flow does not pick up the last State of an unrelated other flow as FROM (02_design.md 24.13)", async () => {
    // Flow A: a fully separate, unrelated chain that happens to sort before Flow B in
    // getTopBlocks(true) position order.
    const flowAStart = state(workspace, "A1");
    const flowAEnd = state(workspace, "A2");
    flowAStart.nextConnection!.connect(flowAEnd.previousConnection!);
    await flushEvents();

    // Flow B: starts as a single State, "B1".
    const flowBHead = state(workspace, "B1");
    await flushEvents();

    // Connect a new Transition as the new head of Flow B (nothing precedes it in its own
    // chain; "B1" now follows it). Confirmed live: without root-scoping the search to this
    // Transition's own connected tree (getRootBlock()), the backward search would spill
    // into Flow A and wrongly set FROM to "A2".
    //
    // Connecting via transition.nextConnection gives *flowBHead* a new parent (transition),
    // not the other way around, so the Transition itself doesn't get a parent-change event
    // from this call alone; firePositionOnlyMove simulates the dragged block's own move
    // event that a real drag-and-drop would additionally fire for it.
    const transition = workspace.newBlock("state_transition");
    await flushEvents();
    transition.nextConnection!.connect(flowBHead.previousConnection!);
    firePositionOnlyMove(transition);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("[*]");
    expect(transition.getFieldValue("TO")).toBe("B1");
  });

  it("a Duplicate-simulated Transition (pre-registered ineligible) keeps its copied values on reconnect", async () => {
    const idle = state(workspace, "Idle");
    state(workspace, "Done");
    await flushEvents();

    const dup = workspace.newBlock("state_transition");
    dup.setFieldValue("Done", "FROM");
    dup.setFieldValue("Idle", "TO");
    registerIneligible([dup.id]);
    await flushEvents();

    idle.nextConnection!.connect(dup.previousConnection!);
    await flushEvents();

    expect(dup.getFieldValue("FROM")).toBe("Done");
    expect(dup.getFieldValue("TO")).toBe("Idle");
  });
});
