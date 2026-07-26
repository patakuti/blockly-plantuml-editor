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

  it("defaults FROM to [*] when Transition is the first statement in a Composite State's DO (02_design.md 43)", async () => {
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

    // This Transition is both the first and only statement in "Working"'s own DO body, so
    // both FROM and TO represent Working's own internal start/end ([*]) -- not the outer
    // siblings "Idle"/"Done", nor Working's own name. getNextBlock() never leaks out to the
    // outer chain (02_design.md 43.2), so forward search stays bounded to DO and does not
    // reach "Done".
    expect(inner.getFieldValue("FROM")).toBe("[*]");
    expect(inner.getFieldValue("TO")).toBe("[*]");
  });

  it("defaults FROM to [*] when Transition is the last statement in a Composite State's DO (TO side, 02_design.md 43)", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    const before = state(workspace, "Idle");
    const after = state(workspace, "Done");
    before.nextConnection!.connect(composite.previousConnection!);
    composite.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    const innerBefore = state(workspace, "Sub1");
    composite.getInput("DO")!.connection!.connect(innerBefore.previousConnection!);
    await flushEvents();

    const inner = workspace.newBlock("state_transition");
    innerBefore.nextConnection!.connect(inner.previousConnection!);
    await flushEvents();

    // Nothing follows this Transition inside "Working"'s DO body, so TO is [*] (Working's
    // own internal end), not the outer sibling "Done".
    expect(inner.getFieldValue("FROM")).toBe("Sub1");
    expect(inner.getFieldValue("TO")).toBe("[*]");
  });

  it("defaults FROM to the Composite State's own name for a Transition placed right after it closes (02_design.md 43)", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    const innerState = state(workspace, "Sub1");
    composite.getInput("DO")!.connection!.connect(innerState.previousConnection!);
    await flushEvents();

    const transition = workspace.newBlock("state_transition");
    composite.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    // The Transition is a sibling right after the (non-empty) Composite State, not nested
    // inside its DO, so FROM is Working's own name (the composite as a whole), unlike the
    // "first statement in DO" case above.
    expect(transition.getFieldValue("FROM")).toBe("Working");
  });

  it("defaults FROM to the Composite State's own name even when its DO body is empty (02_design.md 43)", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    await flushEvents();

    const transition = workspace.newBlock("state_transition");
    composite.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Working");
  });

  it("defaults TO to the Composite State's own name for a Transition placed right before it", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    await flushEvents();

    const transition = workspace.newBlock("state_transition");
    await flushEvents();
    // connect() moves *composite* (the block snapping into place after transition), not
    // transition itself, so transition needs its own explicit move event fired too (same
    // caveat as the "connecting a Transition to the head of one flow" case below).
    transition.nextConnection!.connect(composite.previousConnection!);
    firePositionOnlyMove(transition);
    await flushEvents();

    expect(transition.getFieldValue("TO")).toBe("Working");
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

  it("does not cross a parallel region boundary (Composite State with 2 regions, 02_design.md 43.4)", async () => {
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

    // REGION1 is its own independent chain; this Transition is first in it, so FROM is
    // REGION1's own internal start ([*]), never crossing into DO's "A" (the parallel-region
    // known limitation from 01_requirements.md 4.12 is resolved by this Round).
    expect(region1Transition.getFieldValue("FROM")).toBe("[*]");
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

  it("skips over a preceding Transition inside a Composite State's DO, reaching [*] when nothing else precedes it (02_design.md 43.3)", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    await flushEvents();

    // DO body: [firstTransition, secondTransition] -- no State at all inside DO.
    const firstTransition = workspace.newBlock("state_transition");
    composite.getInput("DO")!.connection!.connect(firstTransition.previousConnection!);
    await flushEvents();

    const secondTransition = workspace.newBlock("state_transition");
    firstTransition.nextConnection!.connect(secondTransition.previousConnection!);
    await flushEvents();

    // secondTransition's backward scan skips over firstTransition (also a Transition), then
    // hits the head of DO (firstTransition has no preceding sibling of its own) -- so [*],
    // not a leak out to whatever precedes the Composite State itself.
    expect(secondTransition.getFieldValue("FROM")).toBe("[*]");
  });

  it("treats Fork/Join blocks as nameable neighbors, same as State", async () => {
    const fork = workspace.newBlock("state_fork");
    fork.setFieldValue("Fork1", "NAME");
    const transition = workspace.newBlock("state_transition");
    fork.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Fork1");
  });

  it("skips over a preceding State Description to reach the State before it (bug fix, round 35)", async () => {
    const before = state(workspace, "Idle");
    const description = workspace.newBlock("state_description");
    before.nextConnection!.connect(description.previousConnection!);
    await flushEvents();

    const transition = workspace.newBlock("state_transition");
    description.nextConnection!.connect(transition.previousConnection!);
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("Idle");
  });

  it("skips over a following State Description to reach the State after it (bug fix, round 35)", async () => {
    const after = state(workspace, "Done");
    const description = workspace.newBlock("state_description");
    description.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    const transition = workspace.newBlock("state_transition");
    transition.nextConnection!.connect(description.previousConnection!);
    firePositionOnlyMove(transition);
    await flushEvents();

    expect(transition.getFieldValue("TO")).toBe("Done");
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

describe("applyStateAutoDefault for state_description (FR-STATE-19, round 34)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    installAutoDefaultWiring(workspace);
  });

  it("defaults STATE to the immediately preceding State", async () => {
    const before = state(workspace, "Idle");
    const description = workspace.newBlock("state_description");
    before.nextConnection!.connect(description.previousConnection!);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("Idle");
  });

  it("defaults STATE to the immediately preceding Composite State's own name", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    const description = workspace.newBlock("state_description");
    composite.nextConnection!.connect(description.previousConnection!);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("Working");
  });

  it("skips over a preceding Transition to reach the State before it", async () => {
    const before = state(workspace, "Idle");
    const transition = workspace.newBlock("state_transition");
    before.nextConnection!.connect(transition.previousConnection!);
    const description = workspace.newBlock("state_description");
    transition.nextConnection!.connect(description.previousConnection!);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("Idle");
  });

  it("skips over a preceding State Description (multi-line description idiom, round 35) to reach the State before it", async () => {
    const before = state(workspace, "Idle");
    const firstDescription = workspace.newBlock("state_description");
    before.nextConnection!.connect(firstDescription.previousConnection!);
    await flushEvents();

    const secondDescription = workspace.newBlock("state_description");
    firstDescription.nextConnection!.connect(secondDescription.previousConnection!);
    await flushEvents();

    expect(secondDescription.getFieldValue("STATE")).toBe("Idle");
  });

  it("skips over a mix of preceding Transition and State Description blocks to reach the State before them", async () => {
    const before = state(workspace, "Idle");
    const transition = workspace.newBlock("state_transition");
    before.nextConnection!.connect(transition.previousConnection!);
    const firstDescription = workspace.newBlock("state_description");
    transition.nextConnection!.connect(firstDescription.previousConnection!);
    await flushEvents();

    const secondDescription = workspace.newBlock("state_description");
    firstDescription.nextConnection!.connect(secondDescription.previousConnection!);
    await flushEvents();

    expect(secondDescription.getFieldValue("STATE")).toBe("Idle");
  });

  it("leaves STATE unset when nothing precedes it", async () => {
    const description = workspace.newBlock("state_description");
    await flushEvents();
    firePositionOnlyMove(description);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("");
  });

  it.each(["state_choice", "state_fork", "state_join"])(
    "leaves STATE unset when the immediately preceding block is a %s (not treated as State/Composite-like)",
    async (type) => {
      const pseudo = workspace.newBlock(type);
      pseudo.setFieldValue("P1", "NAME");
      const description = workspace.newBlock("state_description");
      pseudo.nextConnection!.connect(description.previousConnection!);
      await flushEvents();

      expect(description.getFieldValue("STATE")).toBe("");
    },
  );

  it("does not skip past a preceding Choice/Fork/Join to find an earlier State (stops the search there)", async () => {
    const before = state(workspace, "Idle");
    const choice = workspace.newBlock("state_choice");
    choice.setFieldValue("C1", "NAME");
    before.nextConnection!.connect(choice.previousConnection!);
    const description = workspace.newBlock("state_description");
    choice.nextConnection!.connect(description.previousConnection!);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("");
  });

  it("leaves STATE unset when it is the first statement in a Composite State's DO (does not leak to the outer chain)", async () => {
    const outerBefore = state(workspace, "Idle");
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Working", "NAME");
    outerBefore.nextConnection!.connect(composite.previousConnection!);
    await flushEvents();

    const description = workspace.newBlock("state_description");
    composite.getInput("DO")!.connection!.connect(description.previousConnection!);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("");
  });

  it("leaves a standalone State Description untouched, then resolves once it actually connects", async () => {
    const description = workspace.newBlock("state_description");
    await flushEvents();
    firePositionOnlyMove(description);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("");
    expect(isEligible(description.id)).toBe(true);

    const before = state(workspace, "Idle");
    before.nextConnection!.connect(description.previousConnection!);
    await flushEvents();

    expect(description.getFieldValue("STATE")).toBe("Idle");
    expect(isEligible(description.id)).toBe(false);
  });
});
