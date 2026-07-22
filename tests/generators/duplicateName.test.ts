import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import {
  guardDuplicateRename,
  nextAvailableName,
  resolveDuplicateNamesOnCreate,
} from "../../src/blocks/common/duplicateName";
import { syncParticipantRename } from "../../src/blocks/sequence/renameSync";
import { syncStateRename } from "../../src/blocks/state/renameSync";

defineSequenceBlocks();
defineStateBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("nextAvailableName", () => {
  it("returns the desired name unchanged when it's free", () => {
    expect(nextAvailableName(new Set(), "State1")).toBe("State1");
  });

  it("increments a trailing number until free", () => {
    expect(nextAvailableName(new Set(["State1"]), "State1")).toBe("State2");
    expect(nextAvailableName(new Set(["State1", "State2"]), "State1")).toBe("State3");
  });

  it("appends 2 when there's no trailing number", () => {
    expect(nextAvailableName(new Set(["Composite"]), "Composite")).toBe("Composite2");
    expect(nextAvailableName(new Set(["Composite", "Composite2"]), "Composite")).toBe("Composite3");
  });
});

describe("guardDuplicateRename (FR-SEQ-14/FR-STATE-10)", () => {
  const SEQUENCE_OWNER_TYPES = new Set(["sequence_participant"]);
  const STATE_OWNER_TYPES = new Set(["state_state", "state_composite", "state_choice"]);
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("reverts a rename to a name already used by another participant", async () => {
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        guardDuplicateRename(workspace, event, SEQUENCE_OWNER_TYPES);
      }
    });

    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    await flushEvents();
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");
    await flushEvents();

    bob.setFieldValue("Alice", "NAME");
    await flushEvents();

    expect(bob.getFieldValue("NAME")).toBe("Bob");
  });

  it("allows a rename to a name that's still unique", async () => {
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        guardDuplicateRename(workspace, event, SEQUENCE_OWNER_TYPES);
      }
    });

    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");

    alice.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(alice.getFieldValue("NAME")).toBe("Alicia");
  });

  it("treats state, composite, and choice as one shared namespace", async () => {
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        guardDuplicateRename(workspace, event, STATE_OWNER_TYPES);
      }
    });

    const state = workspace.newBlock("state_state");
    state.setFieldValue("A", "NAME");
    await flushEvents();
    const choice = workspace.newBlock("state_choice");
    choice.setFieldValue("B", "NAME");
    await flushEvents();

    choice.setFieldValue("A", "NAME");
    await flushEvents();

    expect(choice.getFieldValue("NAME")).toBe("B");
  });

  it("does not block a no-op rename back to the same value", async () => {
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        guardDuplicateRename(workspace, event, SEQUENCE_OWNER_TYPES);
      }
    });

    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    await flushEvents();

    alice.setFieldValue("Alice", "NAME");
    await flushEvents();

    expect(alice.getFieldValue("NAME")).toBe("Alice");
  });
});

describe("resolveDuplicateNamesOnCreate (FR-SEQ-14/FR-STATE-10)", () => {
  const SEQUENCE_OWNER_TYPES = new Set(["sequence_participant"]);
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockCreate) {
        resolveDuplicateNamesOnCreate(workspace, event, SEQUENCE_OWNER_TYPES);
      }
    });
  });

  it("auto-renames a newly created block whose default name collides", async () => {
    const first = workspace.newBlock("sequence_participant");
    await flushEvents();
    expect(first.getFieldValue("NAME")).toBe("Participant");

    const second = workspace.newBlock("sequence_participant");
    await flushEvents();

    expect(second.getFieldValue("NAME")).toBe("Participant2");
  });

  it("leaves a newly created block alone when its name doesn't collide", async () => {
    const first = workspace.newBlock("sequence_participant");
    first.setFieldValue("Alice", "NAME");
    await flushEvents();

    const second = workspace.newBlock("sequence_participant");
    second.setFieldValue("Bob", "NAME");
    await flushEvents();

    expect(first.getFieldValue("NAME")).toBe("Alice");
    expect(second.getFieldValue("NAME")).toBe("Bob");
  });

  it("resolves a batch of several colliding creations against each other", async () => {
    const a = workspace.newBlock("sequence_participant");
    await flushEvents();
    const b = workspace.newBlock("sequence_participant");
    await flushEvents();
    const c = workspace.newBlock("sequence_participant");
    await flushEvents();

    const names = [a, b, c].map((block) => block.getFieldValue("NAME"));
    expect(new Set(names).size).toBe(3);
    expect(names).toContain("Participant");
    expect(names).toContain("Participant2");
    expect(names).toContain("Participant3");
  });

  it("still converges to unique names when several colliding blocks are built in one synchronous batch (import-like)", async () => {
    // PlantUML import builds every block via workspace.newBlock() back-to-back
    // in a single synchronous loop, so (unlike a real user editing one field
    // at a time) many BlockCreate events queue up before any of them fire.
    // Which occurrence ends up keeping the original name is not guaranteed to
    // be "first wins" in that case (02_design.md Round 13 known limitation),
    // but the result must still end up unique.
    const a = workspace.newBlock("sequence_participant");
    a.setFieldValue("Same", "NAME");
    const b = workspace.newBlock("sequence_participant");
    b.setFieldValue("Same", "NAME");
    const c = workspace.newBlock("sequence_participant");
    c.setFieldValue("Same", "NAME");
    await flushEvents();

    const names = [a, b, c].map((block) => block.getFieldValue("NAME"));
    expect(new Set(names).size).toBe(3);
    expect(names).toContain("Same");
  });
});

describe("guardDuplicateRename gating onFieldChange (main.ts wiring)", () => {
  it("a rejected rename never reaches rename-sync, so Message FROM/TO stays put", async () => {
    const SEQUENCE_OWNER_TYPES = new Set(["sequence_participant"]);
    const workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        const reverted = guardDuplicateRename(workspace, event, SEQUENCE_OWNER_TYPES);
        if (!reverted) syncParticipantRename(workspace, event);
      }
    });

    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    await flushEvents();
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");
    await flushEvents();

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");
    await flushEvents();

    bob.setFieldValue("Alice", "NAME");
    // The revert's own BlockChange event ("Alice" -> "Bob" on `bob`) is queued
    // asynchronously and only lands on a *later* flush than the rejected
    // rename itself -- a single flushEvents() here isn't enough to exercise
    // it, which is exactly how this regression slipped past the first draft
    // of this test (caught instead via manual testing in a live browser).
    await flushEvents();
    await flushEvents();

    expect(bob.getFieldValue("NAME")).toBe("Bob");
    expect(message.getFieldValue("FROM")).toBe("Alice");
    expect(message.getFieldValue("TO")).toBe("Bob");
  });

  it("regression: the revert echo must not retarget the real owner's references onto the reverted block", async () => {
    // This is the exact bug found via manual browser testing: renaming a
    // block to a name already owned by another block would get rejected and
    // reverted, but the revert's own echo event ("Idle" -> "State1") would
    // then be treated as an ordinary rename by onFieldChange, silently
    // repointing every Transition that legitimately referenced "Idle" onto
    // the unrelated "State1" block instead.
    const STATE_OWNER_TYPES = new Set(["state_state", "state_composite", "state_choice"]);
    const workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        const reverted = guardDuplicateRename(workspace, event, STATE_OWNER_TYPES);
        if (!reverted) syncStateRename(workspace, event);
      }
    });

    const idle = workspace.newBlock("state_state");
    idle.setFieldValue("Idle", "NAME");
    await flushEvents();
    const other = workspace.newBlock("state_state");
    other.setFieldValue("State1", "NAME");
    await flushEvents();

    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("Idle", "TO");
    await flushEvents();

    // Attempt to rename `other` ("State1") to the already-used "Idle" -- rejected.
    other.setFieldValue("Idle", "NAME");
    await flushEvents();
    await flushEvents();

    expect(other.getFieldValue("NAME")).toBe("State1");
    expect(idle.getFieldValue("NAME")).toBe("Idle");
    expect(transition.getFieldValue("TO")).toBe("Idle");
  });
});
