import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { parseSequencePlantUml } from "../../src/import/sequenceImportParser";
import { buildSequenceWorkspace } from "../../src/import/sequenceImportBuilder";

defineSequenceBlocks();

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
