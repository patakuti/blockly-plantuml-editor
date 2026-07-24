import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineComponentBlocks } from "../../src/blocks/component/blocks";
import { applyComponentAutoDefault } from "../../src/blocks/component/autoDefault";
import {
  isEligible,
  registerIneligible,
  trackBlockCreate,
} from "../../src/blocks/common/autoDefaultTracking";

defineComponentBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Wires the same BlockCreate/BlockMove handling main.ts installs for the component diagram (02_design.md 29.3). */
function installAutoDefaultWiring(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event instanceof Blockly.Events.BlockCreate) trackBlockCreate(event);
    if (event instanceof Blockly.Events.BlockMove && event.blockId && isEligible(event.blockId)) {
      const block = workspace.getBlockById(event.blockId);
      if (block) applyComponentAutoDefault(workspace, block);
    }
  });
}

function firePositionOnlyMove(block: Blockly.Block): void {
  Blockly.Events.fire(new Blockly.Events.BlockMove(block));
}

function component(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock("component_component");
  block.setFieldValue(name, "NAME");
  return block;
}

describe("applyComponentAutoDefault (FR-COMP-07)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    installAutoDefaultWiring(workspace);
  });

  it("defaults FROM to the preceding Component and TO to the following Component (inserted between two already-connected Components)", async () => {
    const before = component(workspace, "Frontend");
    const after = component(workspace, "Backend");
    const dependency = workspace.newBlock("component_dependency");
    // Both connections established synchronously, matching how a real drag-and-drop
    // insertion between two already-connected blocks resolves before any event is
    // delivered (Blockly's event queue is asynchronous).
    before.nextConnection!.connect(dependency.previousConnection!);
    dependency.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("Frontend");
    expect(dependency.getFieldValue("TO")).toBe("Backend");
  });

  it("leaves TO unresolved when built incrementally (Dependency connected before the following Component exists yet)", async () => {
    // Known limitation, same as State's Transition (02_design.md 24.13/29.3): FROM/TO are
    // only ever evaluated once, at this Dependency's own first connection. Connecting a
    // Component after it later is a separate event for that Component, not this Dependency,
    // so TO is never retroactively filled in.
    const before = component(workspace, "Frontend");
    const dependency = workspace.newBlock("component_dependency");
    before.nextConnection!.connect(dependency.previousConnection!);
    await flushEvents();

    const after = component(workspace, "Backend");
    dependency.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("Frontend");
    expect(dependency.getFieldValue("TO")).toBe("");
  });

  it("leaves FROM/TO unresolved when nothing precedes/follows", async () => {
    const dependency = workspace.newBlock("component_dependency");
    await flushEvents();
    firePositionOnlyMove(dependency);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("");
    expect(dependency.getFieldValue("TO")).toBe("");
  });

  it("sets only FROM when nothing follows, leaving TO unresolved", async () => {
    const before = component(workspace, "Frontend");
    const dependency = workspace.newBlock("component_dependency");
    before.nextConnection!.connect(dependency.previousConnection!);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("Frontend");
    expect(dependency.getFieldValue("TO")).toBe("");
  });

  it("defaults FROM to the enclosing Component's own name when it's the first statement in DO", async () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const before = component(workspace, "Idle");
    const after = component(workspace, "Done");
    before.nextConnection!.connect(outer.previousConnection!);
    outer.nextConnection!.connect(after.previousConnection!);
    await flushEvents();

    const inner = workspace.newBlock("component_dependency");
    outer.getInput("DO")!.connection!.connect(inner.previousConnection!);
    await flushEvents();

    // In PlantUML output order the outer Component itself is emitted right before its own
    // DO body, so it (not the sibling "Idle" before the whole Component) is the nearest
    // nameable predecessor. Forward search still finds "Done" past the Component's end,
    // since nothing follows inside DO.
    expect(inner.getFieldValue("FROM")).toBe("Outer");
    expect(inner.getFieldValue("TO")).toBe("Done");
  });

  it("finds a preceding Component within the same enclosing Component's DO body, not the outer chain", async () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const outerBefore = component(workspace, "Idle");
    outerBefore.nextConnection!.connect(outer.previousConnection!);
    await flushEvents();

    const innerBefore = component(workspace, "Sub1");
    outer.getInput("DO")!.connection!.connect(innerBefore.previousConnection!);
    await flushEvents();

    const inner = workspace.newBlock("component_dependency");
    innerBefore.nextConnection!.connect(inner.previousConnection!);
    await flushEvents();

    expect(inner.getFieldValue("FROM")).toBe("Sub1");
  });

  it("leaves a standalone Dependency untouched even when unrelated Components exist in a different top-level chain", async () => {
    const before = component(workspace, "Idle");
    const after = component(workspace, "Done");
    before.nextConnection!.connect(after.previousConnection!); // one fully-formed, separate top-level chain
    await flushEvents();

    // A brand new standalone Dependency, positioned as its own separate top-level entry --
    // not connected to the Idle/Done chain at all. Component diagrams have no single main
    // chain (02_design.md 27.5/componentWorkspaceToCode), so without the "must actually be
    // connected" guard, this would spuriously pick up "Done" as FROM even though the two
    // are unrelated (same regression as State's 24.12).
    const dependency = workspace.newBlock("component_dependency");
    await flushEvents();
    firePositionOnlyMove(dependency);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("");
    expect(dependency.getFieldValue("TO")).toBe("");
    expect(isEligible(dependency.id)).toBe(true); // stays pending for a later real connection
  });

  it("resolves correctly once a previously-standalone Dependency actually connects", async () => {
    const before = component(workspace, "Idle");
    component(workspace, "Done"); // an unrelated separate top-level chain

    const dependency = workspace.newBlock("component_dependency");
    await flushEvents();
    firePositionOnlyMove(dependency); // dropped standalone first; stays pending (previous test)
    await flushEvents();

    before.nextConnection!.connect(dependency.previousConnection!);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("Idle");
    expect(isEligible(dependency.id)).toBe(false);
  });

  it("connecting a Dependency to the head of one flow does not pick up the last Component of an unrelated other flow as FROM (02_design.md 24.13/29.3)", async () => {
    // Flow A: a fully separate, unrelated chain that happens to sort before Flow B in
    // getTopBlocks(true) position order.
    const flowAStart = component(workspace, "A1");
    const flowAEnd = component(workspace, "A2");
    flowAStart.nextConnection!.connect(flowAEnd.previousConnection!);
    await flushEvents();

    // Flow B: starts as a single Component, "B1".
    const flowBHead = component(workspace, "B1");
    await flushEvents();

    // Connect a new Dependency as the new head of Flow B (nothing precedes it in its own
    // chain; "B1" now follows it). Without root-scoping the search to this Dependency's own
    // connected tree (getRootBlock()), the backward search would spill into Flow A and
    // wrongly set FROM to "A2".
    const dependency = workspace.newBlock("component_dependency");
    await flushEvents();
    dependency.nextConnection!.connect(flowBHead.previousConnection!);
    firePositionOnlyMove(dependency);
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("");
    expect(dependency.getFieldValue("TO")).toBe("B1");
  });

  it("a Duplicate-simulated Dependency (pre-registered ineligible) keeps its copied values on reconnect", async () => {
    const idle = component(workspace, "Idle");
    component(workspace, "Done");
    await flushEvents();

    const dup = workspace.newBlock("component_dependency");
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
