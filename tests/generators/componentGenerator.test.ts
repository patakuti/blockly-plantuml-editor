import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineComponentBlocks } from "../../src/blocks/component/blocks";
import { componentWorkspaceToCode } from "../../src/generators/componentGenerator";
import { validateComponentWorkspace } from "../../src/blocks/component/validation";

defineComponentBlocks();

describe("componentWorkspaceToCode", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("returns an empty shell for an empty workspace", () => {
    expect(componentWorkspaceToCode(workspace)).toBe("@startuml\n@enduml\n");
  });

  it("generates a leaf component with empty braces", () => {
    const component = workspace.newBlock("component_component");
    component.setFieldValue("Alpha", "NAME");

    expect(componentWorkspaceToCode(workspace)).toBe('@startuml\ncomponent "Alpha" {\n}\n@enduml\n');
  });

  it("generates a nested component", () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const inner = workspace.newBlock("component_component");
    inner.setFieldValue("Inner", "NAME");

    outer.getInput("DO")!.connection!.connect(inner.previousConnection!);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\ncomponent "Outer" {\ncomponent "Inner" {\n}\n}\n@enduml\n',
    );
  });

  it("generates a dependency with a label", () => {
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Beta", "TO");
    dependency.setFieldValue("uses", "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe('@startuml\n"Alpha" --> "Beta" : uses\n@enduml\n');
  });

  it("omits the label when empty", () => {
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Beta", "TO");
    dependency.setFieldValue("", "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe('@startuml\n"Alpha" --> "Beta"\n@enduml\n');
  });

  it("emits a raw line verbatim and unescaped", () => {
    const raw = workspace.newBlock("component_raw_line");
    raw.setFieldValue('interface "Foo"', "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe('@startuml\ninterface "Foo"\n@enduml\n');
  });

  it("includes every disconnected top-level chain, not just one", () => {
    const componentA = workspace.newBlock("component_component");
    componentA.setFieldValue("A", "NAME");
    const componentB = workspace.newBlock("component_component");
    componentB.setFieldValue("B", "NAME");
    componentA.moveBy(0, 0);
    componentB.moveBy(0, 50);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\ncomponent "A" {\n}\ncomponent "B" {\n}\n@enduml\n',
    );
  });
});

describe("validateComponentWorkspace", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("does not warn when FROM/TO reference declared components", () => {
    const component = workspace.newBlock("component_component");
    component.setFieldValue("Alpha", "NAME");
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Alpha", "TO");

    expect(validateComponentWorkspace(workspace)).toEqual([]);
  });

  it("warns when FROM/TO reference a component that doesn't exist", () => {
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Ghost", "FROM");
    dependency.setFieldValue("Ghost2", "TO");

    const warnings = validateComponentWorkspace(workspace);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].blockId).toBe(dependency.id);
    expect(warnings[0].message).toContain('FROM="Ghost"');
    expect(warnings[0].message).toContain('TO="Ghost2"');
  });

  it("treats a nested component's own name as a valid reference target", () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const inner = workspace.newBlock("component_component");
    inner.setFieldValue("Inner", "NAME");
    outer.getInput("DO")!.connection!.connect(inner.previousConnection!);

    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Outer", "FROM");
    dependency.setFieldValue("Inner", "TO");

    expect(validateComponentWorkspace(workspace)).toEqual([]);
  });
});
