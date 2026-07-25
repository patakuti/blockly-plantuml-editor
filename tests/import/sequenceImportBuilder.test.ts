import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { parseSequencePlantUml } from "../../src/import/sequenceImportParser";
import { buildSequenceWorkspace } from "../../src/import/sequenceImportBuilder";
import { syncParticipantRename } from "../../src/blocks/sequence/renameSync";
import { guardDuplicateRename, resolveDuplicateNamesOnCreate } from "../../src/blocks/common/duplicateName";

defineSequenceBlocks();

const SEQUENCE_OWNER_TYPES = new Set(["sequence_participant", "sequence_actor"]);

/** Mirrors main.ts's actual per-instance change-listener wiring (guardDuplicateRename gating onFieldChange), which the plain buildSequenceWorkspace() call above never exercises on its own. */
function wireSequenceChangeListeners(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event instanceof Blockly.Events.BlockCreate) {
      resolveDuplicateNamesOnCreate(workspace, event, SEQUENCE_OWNER_TYPES);
    }
    if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
      const reverted = guardDuplicateRename(workspace, event, SEQUENCE_OWNER_TYPES);
      if (!reverted) syncParticipantRename(workspace, event);
    }
  });
}

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Regression test for the same class of corruption bug fixed in
 * stateImportBuilder.ts (02_design.md 37.7a/40.1): a freshly created
 * sequence_participant/sequence_actor block starts out holding its block
 * definition's hardcoded default NAME text ("Participant"/"Actor"), and the
 * importer's very next step overwrites it with the name actually parsed from
 * the source. That overwrite used to be a plain `setFieldValue` call, which
 * fires a BlockChange event indistinguishable from a real user rename -- if a
 * real, correctly-referenced participant happens to already be named exactly
 * like that hardcoded default, rename-sync would "helpfully" retarget that
 * unrelated, correct reference onto the brand-new block, corrupting it.
 * Confirmed live before the fix: importing this exact source turned the
 * Message's FROM from "Participant" into "Bob".
 */
describe("buildSequenceWorkspace + the app's actual change-listener wiring (FR-SEQ-13)", () => {
  it("does not corrupt an existing Message's FROM when a later participant node happens to share the block's default name", async () => {
    const workspace = new Blockly.Workspace();
    wireSequenceChangeListeners(workspace);

    const text = '@startuml\nparticipant "Participant"\n"Participant" -> "Bob": hi\nparticipant "Bob"\n@enduml\n';
    buildSequenceWorkspace(workspace, parseSequencePlantUml(text));
    await flushEvents();
    await flushEvents();

    const message = workspace.getBlocksByType("sequence_message", false)[0];
    expect(message.getFieldValue("FROM")).toBe("Participant");
    expect(message.getFieldValue("TO")).toBe("Bob");
  });

  it("does not corrupt an existing Message's FROM when a later actor node happens to share the block's default name", async () => {
    const workspace = new Blockly.Workspace();
    wireSequenceChangeListeners(workspace);

    const text = '@startuml\nactor "Actor"\n"Actor" -> "Bob": hi\nactor "Bob"\n@enduml\n';
    buildSequenceWorkspace(workspace, parseSequencePlantUml(text));
    await flushEvents();
    await flushEvents();

    const message = workspace.getBlocksByType("sequence_message", false)[0];
    expect(message.getFieldValue("FROM")).toBe("Actor");
    expect(message.getFieldValue("TO")).toBe("Bob");
  });
});

/**
 * Regression test for a Blockly FieldDropdown option-cache bug (02_design.md
 * 20.1, same root cause as 19.4's state_transition fix): a dynamic dropdown
 * field's cached options (computed once, before any participant existed to
 * find) made `getText()` keep showing "(no participants)" after import even
 * though `getFieldValue()`/the generated PlantUML were already correct.
 */
describe("buildSequenceWorkspace dropdown display", () => {
  it("shows the correct participant names on a Message block's FROM/TO fields, not a stale cache", () => {
    const workspace = new Blockly.Workspace();
    const text = '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": Hello\n@enduml';
    buildSequenceWorkspace(workspace, parseSequencePlantUml(text));

    const message = workspace.getBlocksByType("sequence_message", false)[0];
    expect(message.getFieldValue("FROM")).toBe("Alice");
    expect(message.getField("FROM")!.getText()).toBe("Alice");
    expect(message.getFieldValue("TO")).toBe("Bob");
    expect(message.getField("TO")!.getText()).toBe("Bob");
  });

  it("shows the correct participant name on a Note block's TARGET field, not a stale cache", () => {
    const workspace = new Blockly.Workspace();
    const text = '@startuml\nparticipant "Alice"\nparticipant "Bob"\nnote left of "Bob": hi\n@enduml';
    buildSequenceWorkspace(workspace, parseSequencePlantUml(text));

    const note = workspace.getBlocksByType("sequence_note", false)[0];
    expect(note.getFieldValue("TARGET")).toBe("Bob");
    expect(note.getField("TARGET")!.getText()).toBe("Bob");
  });
});

describe("buildSequenceWorkspace activate/deactivate (FR-SEQ-18)", () => {
  it("builds sequence_activate/sequence_deactivate blocks from activate/deactivate nodes", () => {
    const workspace = new Blockly.Workspace();
    const text =
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n' +
      '"Alice" -> "Bob": Hello\nactivate "Bob"\n"Bob" -> "Alice": Hi\ndeactivate "Bob"\n@enduml';
    buildSequenceWorkspace(workspace, parseSequencePlantUml(text));

    const activate = workspace.getBlocksByType("sequence_activate", false)[0];
    expect(activate.getFieldValue("TARGET")).toBe("Bob");
    expect(activate.getField("TARGET")!.getText()).toBe("Bob");

    const deactivate = workspace.getBlocksByType("sequence_deactivate", false)[0];
    expect(deactivate.getFieldValue("TARGET")).toBe("Bob");
    expect(deactivate.getField("TARGET")!.getText()).toBe("Bob");
  });
});

describe("buildSequenceWorkspace actor (FR-SEQ-17)", () => {
  it("builds a sequence_actor block from an actor node", () => {
    const workspace = new Blockly.Workspace();
    const text = '@startuml\nactor "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": Hello\n@enduml';
    buildSequenceWorkspace(workspace, parseSequencePlantUml(text));

    const actors = workspace.getBlocksByType("sequence_actor", false);
    expect(actors).toHaveLength(1);
    expect(actors[0].getFieldValue("NAME")).toBe("Alice");

    const message = workspace.getBlocksByType("sequence_message", false)[0];
    expect(message.getFieldValue("FROM")).toBe("Alice");
    expect(message.getField("FROM")!.getText()).toBe("Alice");
  });
});
