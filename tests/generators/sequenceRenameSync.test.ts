import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { syncParticipantRename } from "../../src/blocks/sequence/renameSync";

defineSequenceBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("syncParticipantRename (FR-SEQ-13)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        syncParticipantRename(workspace, event);
      }
    });
  });

  it("updates Message FROM/TO when the referenced participant is renamed", async () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");

    alice.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(message.getFieldValue("FROM")).toBe("Alicia");
    expect(message.getFieldValue("TO")).toBe("Bob");
    // FieldDropdown caches its option list and only resolves display text
    // (getText) against that cache, so this also needs a fresh cache to
    // show "Alicia" instead of the stale "Alice" (see setDropdownFieldValue.ts).
    expect(message.getField("FROM")!.getText()).toBe("Alicia");
  });

  it("updates Note TARGET when the referenced participant is renamed", async () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");

    const note = workspace.newBlock("sequence_note");
    note.setFieldValue("Alice", "TARGET");

    alice.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(note.getFieldValue("TARGET")).toBe("Alicia");
  });

  it("updates Message FROM/TO when the referenced actor is renamed (FR-SEQ-17)", async () => {
    const alice = workspace.newBlock("sequence_actor");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");

    alice.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(message.getFieldValue("FROM")).toBe("Alicia");
    expect(message.getFieldValue("TO")).toBe("Bob");
  });

  it("does not touch references to a different participant", async () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Bob", "FROM");
    message.setFieldValue("Bob", "TO");

    alice.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(message.getFieldValue("FROM")).toBe("Bob");
    expect(message.getFieldValue("TO")).toBe("Bob");
  });
});
