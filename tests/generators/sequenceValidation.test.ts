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
    activate.nextConnection!.connect(deactivate.previousConnection!);

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

  describe("Activate/Deactivate pairing (FR-SEQ-20)", () => {
    function chain(...blocks: Blockly.Block[]): Blockly.Block[] {
      for (let i = 0; i < blocks.length - 1; i++) {
        blocks[i].nextConnection!.connect(blocks[i + 1].previousConnection!);
      }
      return blocks;
    }

    it("warns on a deactivate with no preceding matching activate", () => {
      const alice = workspace.newBlock("sequence_participant");
      alice.setFieldValue("Alice", "NAME");
      const deactivate = workspace.newBlock("sequence_deactivate");
      deactivate.setFieldValue("Alice", "TARGET");

      expect(hasWarning(validateSequenceWorkspace(workspace), deactivate)).toBe(true);
    });

    it("warns on an activate that's never deactivated", () => {
      const alice = workspace.newBlock("sequence_participant");
      alice.setFieldValue("Alice", "NAME");
      const activate = workspace.newBlock("sequence_activate");
      activate.setFieldValue("Alice", "TARGET");

      expect(hasWarning(validateSequenceWorkspace(workspace), activate)).toBe(true);
    });

    it("does not warn when activate/deactivate are properly paired", () => {
      const alice = workspace.newBlock("sequence_participant");
      alice.setFieldValue("Alice", "NAME");
      const activate = workspace.newBlock("sequence_activate");
      activate.setFieldValue("Alice", "TARGET");
      const deactivate = workspace.newBlock("sequence_deactivate");
      deactivate.setFieldValue("Alice", "TARGET");
      chain(activate, deactivate);

      expect(validateSequenceWorkspace(workspace)).toEqual([]);
    });

    it("pairs nested activates LIFO: closing out of order flags the still-open one", () => {
      const alice = workspace.newBlock("sequence_participant");
      alice.setFieldValue("Alice", "NAME");
      const activate1 = workspace.newBlock("sequence_activate");
      activate1.setFieldValue("Alice", "TARGET");
      const activate2 = workspace.newBlock("sequence_activate");
      activate2.setFieldValue("Alice", "TARGET");
      const deactivate1 = workspace.newBlock("sequence_deactivate");
      deactivate1.setFieldValue("Alice", "TARGET");
      chain(activate1, activate2, deactivate1);

      // Two activates, only one deactivate: the outer (first) activate is
      // matched last (LIFO), so it's the one left unmatched.
      const warnings = validateSequenceWorkspace(workspace);
      expect(hasWarning(warnings, activate1)).toBe(true);
      expect(hasWarning(warnings, activate2)).toBe(false);
      expect(hasWarning(warnings, deactivate1)).toBe(false);
    });

    it("follows generation order through alt branches, not physical nesting", () => {
      // activate happens inside the alt's DO0 branch, deactivate is placed
      // after the alt block ends -- PlantUML processes activate/deactivate
      // sequentially regardless of which branch they're in (02_design.md 33.1).
      const alice = workspace.newBlock("sequence_participant");
      alice.setFieldValue("Alice", "NAME");
      const bob = workspace.newBlock("sequence_participant");
      bob.setFieldValue("Bob", "NAME");

      const alt = workspace.newBlock("sequence_alt");
      const activate = workspace.newBlock("sequence_activate");
      activate.setFieldValue("Alice", "TARGET");
      alt.getInput("DO0")!.connection!.connect(activate.previousConnection!);

      const deactivate = workspace.newBlock("sequence_deactivate");
      deactivate.setFieldValue("Alice", "TARGET");
      chain(alt, deactivate);

      expect(validateSequenceWorkspace(workspace)).toEqual([]);
    });

    it("does not check activate/deactivate on a disconnected extra chain (known limitation)", () => {
      // Two standalone, unconnected top-level blocks: only the first one
      // (created first) is picked as the generated message chain, so the
      // second is excluded from the pairing check just as it's excluded from
      // the generated PlantUML (sequenceWorkspaceToCode's known limitation).
      const alice = workspace.newBlock("sequence_participant");
      alice.setFieldValue("Alice", "NAME");
      const activate = workspace.newBlock("sequence_activate");
      activate.setFieldValue("Alice", "TARGET");
      const deactivate = workspace.newBlock("sequence_deactivate");
      deactivate.setFieldValue("Alice", "TARGET");

      const warnings = validateSequenceWorkspace(workspace);
      expect(hasWarning(warnings, activate)).toBe(true);
      expect(hasWarning(warnings, deactivate)).toBe(false);
    });

    it("combines a reference warning and a pairing warning on the same block", () => {
      const deactivate = workspace.newBlock("sequence_deactivate");
      deactivate.setFieldValue("Ghost", "TARGET");

      const warnings = validateSequenceWorkspace(workspace);
      const warning = warnings.find((w) => w.blockId === deactivate.id);
      expect(warning?.message).toContain("References a participant that doesn't exist");
      expect(warning?.message).toContain("never activated");
    });
  });
});
