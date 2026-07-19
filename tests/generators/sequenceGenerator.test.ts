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

  it("generates an alt with no else branches by default", () => {
    const alt = workspace.newBlock("sequence_alt");
    alt.setFieldValue("success", "COND");
    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("hi", "TEXT");
    alt.getInput("DO0")!.connection!.connect(message.previousConnection!);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nalt (success)\n"" -> "": hi\nend\n@enduml\n',
    );
  });

  it("generates an alt with extra else branches added via the mutator", () => {
    const alt = workspace.newBlock("sequence_alt");
    alt.setFieldValue("success", "COND");
    alt.loadExtraState!({ extraElseCount: 2 });

    const doMessage = workspace.newBlock("sequence_message");
    doMessage.setFieldValue("ok", "TEXT");
    alt.getInput("DO0")!.connection!.connect(doMessage.previousConnection!);

    alt.setFieldValue("failure", "ELSE_COND_1");
    const else1Message = workspace.newBlock("sequence_message");
    else1Message.setFieldValue("retry", "TEXT");
    alt.getInput("ELSE_BODY_1")!.connection!.connect(else1Message.previousConnection!);

    alt.setFieldValue("timeout", "ELSE_COND_2");
    const else2Message = workspace.newBlock("sequence_message");
    else2Message.setFieldValue("give up", "TEXT");
    alt.getInput("ELSE_BODY_2")!.connection!.connect(else2Message.previousConnection!);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      "@startuml\n" +
        "alt (success)\n" +
        '"" -> "": ok\n' +
        "else (failure)\n" +
        '"" -> "": retry\n' +
        "else (timeout)\n" +
        '"" -> "": give up\n' +
        "end\n@enduml\n",
    );
  });

  it("round-trips the alt else-count mutator state", () => {
    const alt = workspace.newBlock("sequence_alt");
    expect(alt.saveExtraState!()).toEqual({ extraElseCount: 0 });
    expect(alt.getInput("ELSE_LABEL_1")).toBeNull();

    alt.loadExtraState!({ extraElseCount: 2 });
    expect(alt.saveExtraState!()).toEqual({ extraElseCount: 2 });
    expect(alt.getInput("ELSE_LABEL_1")).not.toBeNull();
    expect(alt.getInput("ELSE_LABEL_2")).not.toBeNull();

    alt.loadExtraState!({ extraElseCount: 0 });
    expect(alt.getInput("ELSE_LABEL_1")).toBeNull();
  });

  it("generates an opt block", () => {
    const opt = workspace.newBlock("sequence_opt");
    opt.setFieldValue("maybe", "COND");
    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("extra", "TEXT");
    opt.getInput("DO")!.connection!.connect(message.previousConnection!);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nopt (maybe)\n"" -> "": extra\nend\n@enduml\n',
    );
  });

  it("generates a loop block", () => {
    const loop = workspace.newBlock("sequence_loop");
    loop.setFieldValue("3 times", "COND");
    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("ping", "TEXT");
    loop.getInput("DO")!.connection!.connect(message.previousConnection!);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nloop (3 times)\n"" -> "": ping\nend\n@enduml\n',
    );
  });

  it("generates a note attached to a participant", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");

    const note = workspace.newBlock("sequence_note");
    note.setFieldValue("left", "SIDE");
    note.setFieldValue("Alice", "TARGET");
    note.setFieldValue("remember this", "TEXT");

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nparticipant "Alice"\nnote left of "Alice": remember this\n@enduml\n',
    );
  });

  it("generates nested containers (alt branch containing a loop containing a message)", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const alt = workspace.newBlock("sequence_alt");
    alt.setFieldValue("retryable", "COND");
    const loop = workspace.newBlock("sequence_loop");
    loop.setFieldValue("3 times", "COND");
    const innerMessage = workspace.newBlock("sequence_message");
    innerMessage.setFieldValue("Alice", "FROM");
    innerMessage.setFieldValue("Bob", "TO");
    innerMessage.setFieldValue("ping", "TEXT");
    loop.getInput("DO")!.connection!.connect(innerMessage.previousConnection!);
    alt.getInput("DO0")!.connection!.connect(loop.previousConnection!);

    expect(sequenceWorkspaceToCode(workspace)).toBe(
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n' +
        "alt (retryable)\n" +
        'loop (3 times)\n"Alice" -> "Bob": ping\nend\n' +
        "end\n@enduml\n",
    );
  });
});
