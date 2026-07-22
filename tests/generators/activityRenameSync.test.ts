import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Blockly from "blockly/core";
import { defineActivityBlocks } from "../../src/blocks/activity/blocks";
import { syncSwimlaneRename } from "../../src/blocks/activity/renameSync";
import { openRenameScopeDialog } from "../../src/ui/renameScopeDialog";

vi.mock("../../src/ui/renameScopeDialog", () => ({
  openRenameScopeDialog: vi.fn(),
}));

defineActivityBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("syncSwimlaneRename (FR-ACT-13)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    vi.mocked(openRenameScopeDialog).mockReset();
    workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        syncSwimlaneRename(workspace, event);
      }
    });
  });

  it("renames without a dialog when no other block shares the old name, and repoints the pinned Start reference", async () => {
    const lane = workspace.newBlock("activity_swimlane");
    lane.setFieldValue("Alice", "NAME");

    const start = workspace.newBlock("activity_start");
    start.setFieldValue("Alice", "SWIMLANE");

    lane.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(openRenameScopeDialog).not.toHaveBeenCalled();
    expect(lane.getFieldValue("NAME")).toBe("Alicia");
    expect(start.getFieldValue("SWIMLANE")).toBe("Alicia");
    // FieldDropdown caches its option list and only resolves display text
    // (getText) against that cache, so this also needs a fresh cache to
    // show "Alicia" instead of the stale "Alice" (see setDropdownFieldValue.ts).
    expect(start.getField("SWIMLANE")!.getText()).toBe("Alicia");
  });

  it('leaves other same-named blocks and the pinned Start reference untouched when the user picks "this"', async () => {
    vi.mocked(openRenameScopeDialog).mockResolvedValue("this");

    const lane1 = workspace.newBlock("activity_swimlane");
    lane1.setFieldValue("Alice", "NAME");
    const lane2 = workspace.newBlock("activity_swimlane");
    lane2.setFieldValue("Alice", "NAME");

    const start = workspace.newBlock("activity_start");
    start.setFieldValue("Alice", "SWIMLANE");

    lane1.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(openRenameScopeDialog).toHaveBeenCalledWith({ oldName: "Alice", newName: "Alicia", otherCount: 1 });
    expect(lane1.getFieldValue("NAME")).toBe("Alicia");
    expect(lane2.getFieldValue("NAME")).toBe("Alice");
    // "Alice" still identifies lane2, so the pin (still "Alice") stays valid.
    expect(start.getFieldValue("SWIMLANE")).toBe("Alice");
  });

  it('renames every same-named block and the pinned Start reference when the user picks "all"', async () => {
    vi.mocked(openRenameScopeDialog).mockResolvedValue("all");

    const lane1 = workspace.newBlock("activity_swimlane");
    lane1.setFieldValue("Alice", "NAME");
    const lane2 = workspace.newBlock("activity_swimlane");
    lane2.setFieldValue("Alice", "NAME");
    const lane3 = workspace.newBlock("activity_swimlane");
    lane3.setFieldValue("Bob", "NAME");

    const start = workspace.newBlock("activity_start");
    start.setFieldValue("Alice", "SWIMLANE");

    lane1.setFieldValue("Alicia", "NAME");
    await flushEvents();

    expect(lane1.getFieldValue("NAME")).toBe("Alicia");
    expect(lane2.getFieldValue("NAME")).toBe("Alicia");
    expect(lane3.getFieldValue("NAME")).toBe("Bob");
    expect(start.getFieldValue("SWIMLANE")).toBe("Alicia");
  });
});
