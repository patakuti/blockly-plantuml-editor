import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import { syncStateRename } from "../../src/blocks/state/renameSync";

defineStateBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("syncStateRename (FR-STATE-07)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        syncStateRename(workspace, event);
      }
    });
  });

  it("updates Transition FROM/TO when the referenced state is renamed", async () => {
    const stateA = workspace.newBlock("state_state");
    stateA.setFieldValue("StateA", "NAME");
    const stateB = workspace.newBlock("state_state");
    stateB.setFieldValue("StateB", "NAME");

    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("StateA", "FROM");
    transition.setFieldValue("StateB", "TO");

    stateA.setFieldValue("StateAlpha", "NAME");
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("StateAlpha");
    expect(transition.getFieldValue("TO")).toBe("StateB");
    // FieldDropdown caches its option list and only resolves display text
    // (getText) against that cache, so this also needs a fresh cache to
    // show "StateAlpha" instead of the stale "StateA" (see setDropdownFieldValue.ts).
    expect(transition.getField("FROM")!.getText()).toBe("StateAlpha");
  });

  it("updates Transition FROM/TO when the referenced composite state is renamed", async () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Composite1", "NAME");

    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("Composite1", "TO");

    composite.setFieldValue("CompositeA", "NAME");
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("[*]");
    expect(transition.getFieldValue("TO")).toBe("CompositeA");
    expect(transition.getField("TO")!.getText()).toBe("CompositeA");
  });

  it("does not touch references to a different state or the pseudostate", async () => {
    const stateA = workspace.newBlock("state_state");
    stateA.setFieldValue("StateA", "NAME");
    const stateB = workspace.newBlock("state_state");
    stateB.setFieldValue("StateB", "NAME");

    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("StateB", "TO");

    stateA.setFieldValue("StateAlpha", "NAME");
    await flushEvents();

    expect(transition.getFieldValue("FROM")).toBe("[*]");
    expect(transition.getFieldValue("TO")).toBe("StateB");
  });
});
