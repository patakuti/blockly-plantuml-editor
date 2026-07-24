import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineComponentBlocks } from "../../src/blocks/component/blocks";
import { parseComponentPlantUml } from "../../src/import/componentImportParser";
import { buildComponentWorkspace } from "../../src/import/componentImportBuilder";

defineComponentBlocks();

describe("buildComponentWorkspace", () => {
  it("builds a leaf component", () => {
    const workspace = new Blockly.Workspace();
    buildComponentWorkspace(workspace, parseComponentPlantUml('component "Alpha" {\n}'));

    const component = workspace.getBlocksByType("component_component", false)[0];
    expect(component.getFieldValue("NAME")).toBe("Alpha");
  });

  it("builds a nested component and connects it into the outer component's DO input", () => {
    const workspace = new Blockly.Workspace();
    buildComponentWorkspace(workspace, parseComponentPlantUml('component "Outer" {\ncomponent "Inner" {\n}\n}'));

    const outer = workspace.getBlocksByType("component_component", false).find((b) => b.getFieldValue("NAME") === "Outer")!;
    const inner = outer.getInputTargetBlock("DO")!;
    expect(inner.type).toBe("component_component");
    expect(inner.getFieldValue("NAME")).toBe("Inner");
  });

  it("builds a dependency with FROM/TO/TEXT set", () => {
    const workspace = new Blockly.Workspace();
    buildComponentWorkspace(workspace, parseComponentPlantUml('"Alpha" --> "Beta" : uses'));

    const dependency = workspace.getBlocksByType("component_dependency", false)[0];
    expect(dependency.getFieldValue("FROM")).toBe("Alpha");
    expect(dependency.getFieldValue("TO")).toBe("Beta");
    expect(dependency.getFieldValue("TEXT")).toBe("uses");
  });

  it("builds a raw line verbatim", () => {
    const workspace = new Blockly.Workspace();
    buildComponentWorkspace(workspace, parseComponentPlantUml("skinparam handwritten true"));

    const raw = workspace.getBlocksByType("component_raw_line", false)[0];
    expect(raw.getFieldValue("TEXT")).toBe("skinparam handwritten true");
  });

  /**
   * Regression coverage for the same root cause as stateImportBuilder.test.ts's
   * "dropdown display" tests: a Dependency referencing a Component declared
   * *later* in the source is built before its target exists in the workspace,
   * so without componentImportBuilder.ts's final refresh pass the on-screen
   * dropdown label (not the underlying value) would be stale.
   */
  it("shows the correct name on a Dependency's TO field when the target component is declared later in the source", () => {
    const workspace = new Blockly.Workspace();
    const text = '"Alpha" --> "Beta"\ncomponent "Beta" {\n}';
    buildComponentWorkspace(workspace, parseComponentPlantUml(text));

    const dependency = workspace.getBlocksByType("component_dependency", false)[0];
    expect(dependency.getFieldValue("TO")).toBe("Beta");
    expect(dependency.getField("TO")!.getText()).toBe("Beta");
  });
});
