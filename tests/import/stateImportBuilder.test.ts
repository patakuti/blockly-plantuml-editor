import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import { parseStatePlantUml } from "../../src/import/stateImportParser";
import { buildStateWorkspace } from "../../src/import/stateImportBuilder";
import { syncStateRename } from "../../src/blocks/state/renameSync";
import { guardDuplicateRename, resolveDuplicateNamesOnCreate } from "../../src/blocks/common/duplicateName";

defineStateBlocks();

const STATE_OWNER_TYPES = new Set(["state_state", "state_composite", "state_choice", "state_fork", "state_join"]);

/** Mirrors main.ts's actual per-instance change-listener wiring (guardDuplicateRename gating onFieldChange), which the plain buildStateWorkspace() call above never exercises on its own. */
function wireStateChangeListeners(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event instanceof Blockly.Events.BlockCreate) {
      resolveDuplicateNamesOnCreate(workspace, event, STATE_OWNER_TYPES);
    }
    if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
      const reverted = guardDuplicateRename(workspace, event, STATE_OWNER_TYPES);
      if (!reverted) syncStateRename(workspace, event);
    }
  });
}

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Regression test for a Blockly FieldDropdown option-cache bug found while
 * manually verifying Round 12's import support (02_design.md 22, same root
 * cause as 20.1's sequence-diagram fix but a different trigger): a
 * Transition referencing a State/Composite/Choice declared *later* in the
 * source is built before its target exists in the workspace (buildChain
 * builds in one single pass, in source order), so setFieldValueRefreshingDropdown's
 * cache refresh -- itself correct -- can't yet include an option for a block
 * that doesn't exist yet. getFieldValue()/the generated PlantUML were
 * already correct throughout; only the on-screen dropdown label was wrong.
 */
describe("buildStateWorkspace dropdown display", () => {
  it("shows the correct name on a Transition's TO field when the target state is declared later in the source", () => {
    const workspace = new Blockly.Workspace();
    const text = "@startuml\nA --> B\nstate B\n@enduml";
    buildStateWorkspace(workspace, parseStatePlantUml(text));

    const transition = workspace.getBlocksByType("state_transition", false)[0];
    expect(transition.getFieldValue("TO")).toBe("B");
    expect(transition.getField("TO")!.getText()).toBe("B");
  });

  it("shows the correct name when the target is a Composite State declared later", () => {
    const workspace = new Blockly.Workspace();
    const text = "@startuml\nDecide --> Running : ok\nstate Decide <<choice>>\nstate Running {\n}\n@enduml";
    buildStateWorkspace(workspace, parseStatePlantUml(text));

    const transition = workspace.getBlocksByType("state_transition", false)[0];
    expect(transition.getFieldValue("FROM")).toBe("Decide");
    expect(transition.getField("FROM")!.getText()).toBe("Decide");
    expect(transition.getFieldValue("TO")).toBe("Running");
    expect(transition.getField("TO")!.getText()).toBe("Running");
  });
});

/**
 * Regression test for a corruption bug found while manually verifying Round
 * 27's fork/join support, but pre-existing since Round 9 (02_design.md
 * 37.7a): every freshly created state_state/state_choice/state_composite/
 * state_fork/state_join block starts out holding its block definition's
 * hardcoded default NAME text (e.g. "State1"), and the importer's very next
 * step overwrites it with the name actually parsed from the source. In the
 * live app, that overwrite is a `setFieldValue` call that fires a
 * BlockChange event indistinguishable from a real user rename -- if a real,
 * correctly-referenced state happens to already be named exactly the same as
 * that hardcoded default (an easy coincidence for common defaults like
 * "State1"/"Choice1"/"Fork1"/"Join1"), rename-sync (renameSync.ts) would
 * "helpfully" retarget that unrelated, correct reference onto the brand-new
 * block, corrupting it. Confirmed live (reported by manual verification of
 * Round 27): importing this exact source turned the first Transition's FROM
 * from "State1" into "State2". Only reproducible with the same
 * guardDuplicateRename-gated onFieldChange wiring main.ts actually uses
 * (wireStateChangeListeners above); buildStateWorkspace alone, or
 * buildStateWorkspace plus a bare change listener, never exercises the
 * interaction. Fixed by routing every NAME assignment in
 * stateImportBuilder.ts through duplicateName.ts's setNameSilently, so
 * guardDuplicateRename recognizes and swallows the echo before it ever
 * reaches rename-sync.
 */
describe("buildStateWorkspace + the app's actual change-listener wiring (FR-STATE-07/FR-STATE-IMPORT-02)", () => {
  it("does not corrupt an existing Transition's FROM when a later state_state node happens to share the block's default name", async () => {
    const workspace = new Blockly.Workspace();
    wireStateChangeListeners(workspace);

    const text = "@startuml\nstate State1\nState1 --> Choice1\nstate Choice1 <<choice>>\nChoice1 --> State2\nstate State2\n@enduml";
    buildStateWorkspace(workspace, parseStatePlantUml(text));
    await flushEvents();
    await flushEvents();

    const transitions = workspace.getBlocksByType("state_transition", false);
    expect(transitions[0].getFieldValue("FROM")).toBe("State1");
    expect(transitions[1].getFieldValue("FROM")).toBe("Choice1");
    expect(transitions[1].getFieldValue("TO")).toBe("State2");
  });

  it("does not corrupt an existing Transition's FROM when importing a fork/join diagram (the exact case reported against Round 27)", async () => {
    const workspace = new Blockly.Workspace();
    wireStateChangeListeners(workspace);

    const text =
      "@startuml\n" +
      "state State1\n" +
      "State1 --> Fork1\n" +
      "state Fork1 <<fork>>\n" +
      "Fork1 --> State2\n" +
      "Fork1 --> State3\n" +
      "state State2\n" +
      "State2 --> Join1\n" +
      "state State3\n" +
      "State3 --> Join1\n" +
      "state Join1 <<join>>\n" +
      "@enduml\n";
    buildStateWorkspace(workspace, parseStatePlantUml(text));
    await flushEvents();
    await flushEvents();

    const transitions = workspace.getBlocksByType("state_transition", false);
    expect(transitions[0].getFieldValue("FROM")).toBe("State1");
    expect(transitions[0].getFieldValue("TO")).toBe("Fork1");
  });
});
