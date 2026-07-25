import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineComponentBlocks } from "../../src/blocks/component/blocks";
import { parseComponentPlantUml } from "../../src/import/componentImportParser";
import { buildComponentWorkspace } from "../../src/import/componentImportBuilder";
import { syncComponentRename } from "../../src/blocks/component/renameSync";
import { guardDuplicateRename, resolveDuplicateNamesOnCreate } from "../../src/blocks/common/duplicateName";

defineComponentBlocks();

const COMPONENT_OWNER_TYPES = new Set(["component_component"]);

/** Mirrors main.ts's actual per-instance change-listener wiring (guardDuplicateRename gating onFieldChange), which the plain buildComponentWorkspace() call above never exercises on its own. */
function wireComponentChangeListeners(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    if (event instanceof Blockly.Events.BlockCreate) {
      resolveDuplicateNamesOnCreate(workspace, event, COMPONENT_OWNER_TYPES);
    }
    if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
      const reverted = guardDuplicateRename(workspace, event, COMPONENT_OWNER_TYPES);
      if (!reverted) syncComponentRename(workspace, event);
    }
  });
}

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Regression test for the same class of corruption bug fixed in
 * stateImportBuilder.ts (02_design.md 37.7a/40.1): a freshly created
 * component_component block starts out holding its block definition's
 * hardcoded default NAME text ("Component1"), and the importer's very next
 * step overwrites it with the name actually parsed from the source. That
 * overwrite used to be a plain `setFieldValue` call, which fires a
 * BlockChange event indistinguishable from a real user rename -- if a real,
 * correctly-referenced component happens to already be named exactly like
 * that hardcoded default, rename-sync would "helpfully" retarget that
 * unrelated, correct reference onto the brand-new block, corrupting it.
 * Confirmed live before the fix: importing this exact source turned the
 * Dependency's FROM from "Component1" into "Beta".
 */
describe("buildComponentWorkspace + the app's actual change-listener wiring (FR-COMP-06)", () => {
  it("does not corrupt an existing Dependency's FROM when a later component node happens to share the block's default name", async () => {
    const workspace = new Blockly.Workspace();
    wireComponentChangeListeners(workspace);

    const text = '@startuml\ncomponent "Component1" {\n}\n"Component1" --> "Beta"\ncomponent "Beta" {\n}\n@enduml\n';
    buildComponentWorkspace(workspace, parseComponentPlantUml(text));
    await flushEvents();
    await flushEvents();

    const dependency = workspace.getBlocksByType("component_dependency", false)[0];
    expect(dependency.getFieldValue("FROM")).toBe("Component1");
    expect(dependency.getFieldValue("TO")).toBe("Beta");
  });
});

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
