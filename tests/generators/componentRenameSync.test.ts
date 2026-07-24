import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineComponentBlocks } from "../../src/blocks/component/blocks";
import { syncComponentRename } from "../../src/blocks/component/renameSync";

defineComponentBlocks();

/** Blockly.Events.fire() batches through an internal queue flushed via setTimeout(0), not synchronously. */
function flushEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("syncComponentRename (FR-COMP-06)", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
    workspace.addChangeListener((event) => {
      if (event instanceof Blockly.Events.BlockChange && event.element === "field") {
        syncComponentRename(workspace, event);
      }
    });
  });

  it("updates Dependency FROM/TO when the referenced component is renamed", async () => {
    const alpha = workspace.newBlock("component_component");
    alpha.setFieldValue("Alpha", "NAME");
    const beta = workspace.newBlock("component_component");
    beta.setFieldValue("Beta", "NAME");

    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Beta", "TO");

    alpha.setFieldValue("Frontend", "NAME");
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("Frontend");
    expect(dependency.getFieldValue("TO")).toBe("Beta");
    // FieldDropdown caches its option list and only resolves display text
    // (getText) against that cache, so this also needs a fresh cache to
    // show "Frontend" instead of the stale "Alpha" (see setDropdownFieldValue.ts).
    expect(dependency.getField("FROM")!.getText()).toBe("Frontend");
  });

  it("updates Dependency FROM/TO when the referenced nested component is renamed", async () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const inner = workspace.newBlock("component_component");
    inner.setFieldValue("Inner", "NAME");
    outer.getInput("DO")!.connection!.connect(inner.previousConnection!);

    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Outer", "FROM");
    dependency.setFieldValue("Inner", "TO");

    inner.setFieldValue("Core", "NAME");
    await flushEvents();

    expect(dependency.getFieldValue("TO")).toBe("Core");
    expect(dependency.getField("TO")!.getText()).toBe("Core");
  });

  it("does not touch references to a different component", async () => {
    const alpha = workspace.newBlock("component_component");
    alpha.setFieldValue("Alpha", "NAME");
    const beta = workspace.newBlock("component_component");
    beta.setFieldValue("Beta", "NAME");
    const gamma = workspace.newBlock("component_component");
    gamma.setFieldValue("Gamma", "NAME");

    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Beta", "TO");

    gamma.setFieldValue("Delta", "NAME");
    await flushEvents();

    expect(dependency.getFieldValue("FROM")).toBe("Alpha");
    expect(dependency.getFieldValue("TO")).toBe("Beta");
  });
});
