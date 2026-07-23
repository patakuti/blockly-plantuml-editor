import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { validateSequenceWorkspace } from "../../src/blocks/sequence/validation";

defineSequenceBlocks();

function hasWarning(warnings: { blockId: string }[], block: Blockly.Block): boolean {
  return warnings.some((w) => w.blockId === block.id);
}

describe("validateSequenceWorkspace", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("warns on a message referencing a participant that doesn't exist (FR-SEQ-07)", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Ghost", "TO");

    expect(hasWarning(validateSequenceWorkspace(workspace), message)).toBe(true);
  });

  it("clears the warning once the reference is fixed", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Ghost", "TO");
    expect(hasWarning(validateSequenceWorkspace(workspace), message)).toBe(true);

    message.setFieldValue("Bob", "TO");
    expect(hasWarning(validateSequenceWorkspace(workspace), message)).toBe(false);
  });

  it("warns on a note targeting a participant that doesn't exist", () => {
    const note = workspace.newBlock("sequence_note");
    note.setFieldValue("Ghost", "TARGET");

    expect(hasWarning(validateSequenceWorkspace(workspace), note)).toBe(true);
  });

  it("does not warn on a message referencing an existing actor (FR-SEQ-17)", () => {
    const alice = workspace.newBlock("sequence_actor");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");

    expect(validateSequenceWorkspace(workspace)).toEqual([]);
  });

  it("warns once a referenced actor is removed", () => {
    const alice = workspace.newBlock("sequence_actor");
    alice.setFieldValue("Alice", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Alice", "TO");
    expect(hasWarning(validateSequenceWorkspace(workspace), message)).toBe(false);

    alice.dispose();
    expect(hasWarning(validateSequenceWorkspace(workspace), message)).toBe(true);
  });

  it("does not warn when references are valid", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const bob = workspace.newBlock("sequence_participant");
    bob.setFieldValue("Bob", "NAME");

    const message = workspace.newBlock("sequence_message");
    message.setFieldValue("Alice", "FROM");
    message.setFieldValue("Bob", "TO");

    expect(validateSequenceWorkspace(workspace)).toEqual([]);
  });

  it("warns on activate/deactivate targeting a participant that doesn't exist (FR-SEQ-18)", () => {
    const activate = workspace.newBlock("sequence_activate");
    activate.setFieldValue("Ghost", "TARGET");
    const deactivate = workspace.newBlock("sequence_deactivate");
    deactivate.setFieldValue("Ghost", "TARGET");

    const warnings = validateSequenceWorkspace(workspace);
    expect(hasWarning(warnings, activate)).toBe(true);
    expect(hasWarning(warnings, deactivate)).toBe(true);
  });

  it("does not warn on activate/deactivate targeting an existing participant", () => {
    const alice = workspace.newBlock("sequence_participant");
    alice.setFieldValue("Alice", "NAME");
    const activate = workspace.newBlock("sequence_activate");
    activate.setFieldValue("Alice", "TARGET");
    const deactivate = workspace.newBlock("sequence_deactivate");
    deactivate.setFieldValue("Alice", "TARGET");

    expect(validateSequenceWorkspace(workspace)).toEqual([]);
  });

  it("warns on activate/deactivate with an unset TARGET (empty string)", () => {
    const activate = workspace.newBlock("sequence_activate");

    expect(hasWarning(validateSequenceWorkspace(workspace), activate)).toBe(true);
  });

  it("warns when alt/opt/loop nesting exceeds the readability threshold (FR-SEQ-09)", () => {
    const outer = workspace.newBlock("sequence_alt");
    const level2 = workspace.newBlock("sequence_opt");
    const level3 = workspace.newBlock("sequence_loop");
    const level4 = workspace.newBlock("sequence_alt");

    outer.getInput("DO0")!.connection!.connect(level2.previousConnection!);
    level2.getInput("DO")!.connection!.connect(level3.previousConnection!);
    level3.getInput("DO")!.connection!.connect(level4.previousConnection!);

    const warnings = validateSequenceWorkspace(workspace);
    expect(hasWarning(warnings, outer)).toBe(false);
    expect(hasWarning(warnings, level2)).toBe(false);
    expect(hasWarning(warnings, level3)).toBe(false);
    expect(hasWarning(warnings, level4)).toBe(true);
  });
});
