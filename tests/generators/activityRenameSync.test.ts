import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Blockly from "blockly/core";
import { defineActivityBlocks } from "../../src/blocks/activity/blocks";
import { syncSwimlaneRename } from "../../src/blocks/activity/renameSync";
import { openRenameScopeDialog } from "../../src/ui/renameScopeDialog";
import { parseActivityPlantUml } from "../../src/import/activityImportParser";
import { buildActivityWorkspace } from "../../src/import/activityImportBuilder";

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

  /**
   * Regression test for the same class of bug fixed in stateImportBuilder.ts
   * (02_design.md 37.7a), but manifesting differently here (02_design.md
   * 40.1/40.2): activity_swimlane's names are allowed to collide on purpose
   * (FR-ACT-13), so activity has no `nameOwnerTypes` and never calls
   * guardDuplicateRename at all -- the only other place that recognizes a
   * corrective setFieldValue as not-a-real-rename. Without the
   * isSilentCorrection check added directly to this function, importing a
   * diagram whose real Swimlane happens to already be named exactly like a
   * freshly-created block's hardcoded default ("lane") would pop this
   * function's confirmation dialog *during import*, with no user action
   * having asked for a rename at all -- confirmed live via a stack trace
   * showing openRenameScopeDialog invoked mid-import before this fix.
   */
  it("does not pop the rename-scope dialog during import when a later swimlane node happens to share the block's default name", async () => {
    const text = "@startuml\n|lane|\n:Action1;\n|Frontend|\n:Action2;\n@enduml\n";
    buildActivityWorkspace(workspace, parseActivityPlantUml(text));
    await flushEvents();
    await flushEvents();

    expect(openRenameScopeDialog).not.toHaveBeenCalled();
    const lanes = workspace.getBlocksByType("activity_swimlane", false).map((b) => b.getFieldValue("NAME"));
    expect(lanes).toEqual(["lane", "Frontend"]);
  });
});
