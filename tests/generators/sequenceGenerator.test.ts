import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { sequenceWorkspaceToCode } from "../../src/generators/sequenceGenerator";

defineSequenceBlocks();

describe("sequenceWorkspaceToCode", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("returns an empty shell for an empty workspace", () => {
    expect(sequenceWorkspaceToCode(workspace)).toBe("@startuml\n@enduml\n");
  });

  it("generates participant declarations in Y-position order", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");
    // Position Bob above Alice to confirm ordering follows Y position, not creation order.
    alice.moveBy(0, 100);
    bob.moveBy(0, 0);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nparticipant "Bob"\nparticipant "Alice"\n@enduml\n',
    );
  });

  it("generates a message chain between declared participants", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");
    message.setFieldValue("hello there", "TEXT");

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": hello there\n@enduml\n',
    );
  });

  it("chains multiple messages in order", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const first = workspace.newBlock("sequence_message");
    first.setFieldValue("Alice", "FROM");
    first.setFieldValue("Bob", "TO");
    first.setFieldValue("hello", "TEXT");

    const second = workspace.newBlock("sequence_message");
    second.setFieldValue("Bob", "FROM");
    second.setFieldValue("Alice", "TO");
    second.setFieldValue("hi back", "TEXT");

    first.nextConnection!.connect(second.previousConnection!);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n' +
        '"Alice" -> "Bob": hello\n"Bob" -> "Alice": hi back\n@enduml\n',
    );
  });

  it("escapes @ in message text and quotes/@ in participant names", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue('Ali"ce @enduml', "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue('Ali"ce @enduml', "FROM");
    message.setFieldValue('Ali"ce @enduml', "TO");
    message.setFieldValue("say @enduml now", "TEXT");

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      "@startuml\n" +
        "participant \"Ali'ce &#64;enduml\"\n" +
        "\"Ali'ce &#64;enduml\" -> \"Ali'ce &#64;enduml\": say &#64;enduml now\n" +
        "@enduml\n",
    );
  });

  it("restores FROM/TO through a save/load round-trip even when the message was created before its participants", () => {
    // Regression test: FieldDropdown normally rejects any value not present
    // in its *current* options, which broke restoring a saved workspace
    // whenever a message block happened to be serialized before the
    // participants it references (verified directly against Blockly's
    // actual behavior, not assumed -- see ParticipantDropdownField).
    const message = workspace.newBlock("sequence_message");
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");
    message.setFieldValue("hi", "TEXT");

    const state = Blockly.serialization.workspaces.save(workspace);
    const restoredWorkspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(state, restoredWorkspace);

    expect(sequenceWorkspaceToCode(restoredWorkspace)).toBe(
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": hi\n@enduml\n',
    );
  });
});
