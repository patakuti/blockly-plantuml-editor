import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineActivityBlocks } from "../../src/blocks/activity/blocks";
import { validateActivityWorkspace } from "../../src/blocks/activity/validation";

defineActivityBlocks();

function hasWarning(warnings: { blockId: string }[], block: Blockly.Block): boolean {
  return warnings.some((w) => w.blockId === block.id);
}

describe("validateActivityWorkspace", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("does not warn when there is no start block", () => {
    workspace.newBlock("activity_action");
    expect(validateActivityWorkspace(workspace)).toEqual([]);
  });

  it("does not warn when there is exactly one start block", () => {
    workspace.newBlock("activity_start");
    expect(validateActivityWorkspace(workspace)).toEqual([]);
  });

  it("warns on every start block when more than one exists (FR-ACT-01)", () => {
    const start1 = workspace.newBlock("activity_start");
    const start2 = workspace.newBlock("activity_start");

    const warnings = validateActivityWorkspace(workspace);
    expect(hasWarning(warnings, start1)).toBe(true);
    expect(hasWarning(warnings, start2)).toBe(true);
  });

  it("clears the warning once the duplicate is removed", () => {
    const start1 = workspace.newBlock("activity_start");
    const start2 = workspace.newBlock("activity_start");
    expect(hasWarning(validateActivityWorkspace(workspace), start1)).toBe(true);

    start2.dispose(false);
    expect(hasWarning(validateActivityWorkspace(workspace), start1)).toBe(false);
  });

  it("does not warn when SWIMLANE is left unset (auto)", () => {
    workspace.newBlock("activity_start");
    expect(validateActivityWorkspace(workspace)).toEqual([]);
  });

  it("does not warn when SWIMLANE references an existing swimlane", () => {
    const start = workspace.newBlock("activity_start");
    start.setFieldValue("A", "SWIMLANE");
    workspace.newBlock("activity_swimlane").setFieldValue("A", "NAME");

    expect(hasWarning(validateActivityWorkspace(workspace), start)).toBe(false);
  });

  it("warns when SWIMLANE references a swimlane that doesn't exist", () => {
    const start = workspace.newBlock("activity_start");
    start.setFieldValue("Ghost", "SWIMLANE");

    expect(hasWarning(validateActivityWorkspace(workspace), start)).toBe(true);
  });

  it("clears the stale-swimlane warning once a matching swimlane is added", () => {
    const start = workspace.newBlock("activity_start");
    start.setFieldValue("A", "SWIMLANE");
    expect(hasWarning(validateActivityWorkspace(workspace), start)).toBe(true);

    workspace.newBlock("activity_swimlane").setFieldValue("A", "NAME");
    expect(hasWarning(validateActivityWorkspace(workspace), start)).toBe(false);
  });

  it("warns with both messages when start is duplicated and its swimlane is stale", () => {
    const start1 = workspace.newBlock("activity_start");
    start1.setFieldValue("Ghost", "SWIMLANE");
    workspace.newBlock("activity_start");

    const warnings = validateActivityWorkspace(workspace);
    const warning = warnings.find((w) => w.blockId === start1.id);
    expect(warning?.message).toContain("Only one start block is allowed");
    expect(warning?.message).toContain("References a swimlane that doesn't exist");
  });

  it("does not warn about a swimlane connected into the start-headed chain", () => {
    const start = workspace.newBlock("activity_start");
    const swimlane = workspace.newBlock("activity_swimlane");
    swimlane.setFieldValue("A", "NAME");
    start.nextConnection!.connect(swimlane.previousConnection!);

    expect(hasWarning(validateActivityWorkspace(workspace), swimlane)).toBe(false);
  });

  it("does not warn about a swimlane nested inside a container on the output chain (FR-ACT-16)", () => {
    const start = workspace.newBlock("activity_start");
    const ifBlock = workspace.newBlock("activity_if");
    const swimlane = workspace.newBlock("activity_swimlane");
    swimlane.setFieldValue("A", "NAME");
    start.nextConnection!.connect(ifBlock.previousConnection!);
    ifBlock.getInput("DO0")!.connection!.connect(swimlane.previousConnection!);

    expect(hasWarning(validateActivityWorkspace(workspace), swimlane)).toBe(false);
  });

  it("warns about a swimlane placed standalone, connected to nothing (FR-ACT-16)", () => {
    workspace.newBlock("activity_start");
    const swimlane = workspace.newBlock("activity_swimlane");
    swimlane.setFieldValue("A", "NAME");

    expect(hasWarning(validateActivityWorkspace(workspace), swimlane)).toBe(true);
  });

  it("warns about a swimlane on a disconnected, dropped alternate chain (FR-ACT-16)", () => {
    workspace.newBlock("activity_start"); // the chain that's actually picked as output (14.2)
    const action = workspace.newBlock("activity_action");
    const swimlane = workspace.newBlock("activity_swimlane");
    swimlane.setFieldValue("A", "NAME");
    action.nextConnection!.connect(swimlane.previousConnection!);

    expect(hasWarning(validateActivityWorkspace(workspace), swimlane)).toBe(true);
  });

  it("clears the unreachable-swimlane warning once it's connected into the output chain", () => {
    const start = workspace.newBlock("activity_start");
    const swimlane = workspace.newBlock("activity_swimlane");
    swimlane.setFieldValue("A", "NAME");
    expect(hasWarning(validateActivityWorkspace(workspace), swimlane)).toBe(true);

    start.nextConnection!.connect(swimlane.previousConnection!);
    expect(hasWarning(validateActivityWorkspace(workspace), swimlane)).toBe(false);
  });

  describe("unreachable blocks of any type (FR-ACT-17, generalized from FR-ACT-16)", () => {
    it("warns about a non-swimlane block placed standalone, connected to nothing", () => {
      workspace.newBlock("activity_start");
      const action = workspace.newBlock("activity_action");

      expect(hasWarning(validateActivityWorkspace(workspace), action)).toBe(true);
    });

    it("warns about every block on a disconnected, dropped alternate chain, including inside a container", () => {
      workspace.newBlock("activity_start"); // the chain that's actually picked as output
      const ifBlock = workspace.newBlock("activity_if");
      const nestedAction = workspace.newBlock("activity_action");
      ifBlock.getInput("DO0")!.connection!.connect(nestedAction.previousConnection!);

      const warnings = validateActivityWorkspace(workspace);
      expect(hasWarning(warnings, ifBlock)).toBe(true);
      expect(hasWarning(warnings, nestedAction)).toBe(true);
    });

    it("does not warn about a non-swimlane block connected into the output chain", () => {
      const start = workspace.newBlock("activity_start");
      const action = workspace.newBlock("activity_action");
      start.nextConnection!.connect(action.previousConnection!);

      expect(hasWarning(validateActivityWorkspace(workspace), action)).toBe(false);
    });

    it("clears the warning once the block is connected into the output chain", () => {
      const start = workspace.newBlock("activity_start");
      const action = workspace.newBlock("activity_action");
      expect(hasWarning(validateActivityWorkspace(workspace), action)).toBe(true);

      start.nextConnection!.connect(action.previousConnection!);
      expect(hasWarning(validateActivityWorkspace(workspace), action)).toBe(false);
    });

    it("warns with both messages when a duplicate start's own chain is also unreachable", () => {
      workspace.newBlock("activity_start"); // the chain that's actually picked as output
      const start2 = workspace.newBlock("activity_start");
      const action = workspace.newBlock("activity_action");
      start2.nextConnection!.connect(action.previousConnection!);

      const warnings = validateActivityWorkspace(workspace);
      const warning = warnings.find((w) => w.blockId === start2.id);
      expect(warning?.message).toContain("Only one start block is allowed");
      expect(warning?.message).toContain("isn't part of the diagram's output chain");
      expect(hasWarning(warnings, action)).toBe(true);
    });
  });
});
