import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import { parseStatePlantUml } from "../../src/import/stateImportParser";
import { buildStateWorkspace } from "../../src/import/stateImportBuilder";

defineStateBlocks();

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
