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

  it("returns an empty shell for an empty workspace, defaulting to rectangle style (FR-COMP-09)", () => {
    expect(componentWorkspaceToCode(workspace)).toBe("@startuml\nskinparam componentStyle rectangle\n@enduml\n");
  });

  it("generates a leaf component with empty braces", () => {
    const component = workspace.newBlock("component_component");
    component.setFieldValue("Alpha", "NAME");

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle rectangle\ncomponent "Alpha" {\n}\n@enduml\n',
    );
  });

  it("generates a nested component", () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const inner = workspace.newBlock("component_component");
    inner.setFieldValue("Inner", "NAME");

    outer.getInput("DO")!.connection!.connect(inner.previousConnection!);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle rectangle\ncomponent "Outer" {\ncomponent "Inner" {\n}\n}\n@enduml\n',
    );
  });

  it("generates a dependency with a label", () => {
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Beta", "TO");
    dependency.setFieldValue("uses", "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle rectangle\n"Alpha" --> "Beta" : uses\n@enduml\n',
    );
  });

  it("omits the label when empty", () => {
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Alpha", "FROM");
    dependency.setFieldValue("Beta", "TO");
    dependency.setFieldValue("", "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle rectangle\n"Alpha" --> "Beta"\n@enduml\n',
    );
  });

  it("emits a raw line verbatim and unescaped", () => {
    const raw = workspace.newBlock("component_raw_line");
    raw.setFieldValue('interface "Foo"', "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle rectangle\ninterface "Foo"\n@enduml\n',
    );
  });

  it("escapes quotes/@ in component names and @ in dependency labels", () => {
    const component = workspace.newBlock("component_component");
    component.setFieldValue('Ali"ce @enduml', "NAME");

    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue('Ali"ce @enduml', "FROM");
    dependency.setFieldValue('Ali"ce @enduml', "TO");
    dependency.setFieldValue("say @enduml now", "TEXT");

    expect(componentWorkspaceToCode(workspace)).toBe(
      "@startuml\n" +
        "skinparam componentStyle rectangle\n" +
        "component \"Ali'ce &#64;enduml\" {\n}\n" +
        "\"Ali'ce &#64;enduml\" --> \"Ali'ce &#64;enduml\" : say &#64;enduml now\n" +
        "@enduml\n",
    );
  });

  it("hoists a Dependency nested inside a Component's body to the very end (02_design.md 30)", () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Component1", "NAME");
    const inner = workspace.newBlock("component_component");
    inner.setFieldValue("Component2", "NAME");
    const dependency = workspace.newBlock("component_dependency");
    dependency.setFieldValue("Component2", "FROM");
    dependency.setFieldValue("Component3", "TO");

    outer.getInput("DO")!.connection!.connect(inner.previousConnection!);
    inner.getInput("DO")!.connection!.connect(dependency.previousConnection!);
    const sibling = workspace.newBlock("component_component");
    sibling.setFieldValue("Component3", "NAME");
    outer.nextConnection!.connect(sibling.previousConnection!);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\n' +
        'skinparam componentStyle rectangle\n' +
        'component "Component1" {\n' +
        'component "Component2" {\n' +
        '}\n' +
        '}\n' +
        'component "Component3" {\n' +
        '}\n' +
        '"Component2" --> "Component3"\n' +
        '@enduml\n',
    );
  });

  it("hoists multiple dependencies to the end, preserving their original relative order", () => {
    const component = workspace.newBlock("component_component");
    component.setFieldValue("Alpha", "NAME");
    const first = workspace.newBlock("component_dependency");
    first.setFieldValue("Alpha", "FROM");
    first.setFieldValue("Beta", "TO");
    component.getInput("DO")!.connection!.connect(first.previousConnection!);
    const second = workspace.newBlock("component_dependency");
    second.setFieldValue("Beta", "FROM");
    second.setFieldValue("Alpha", "TO");
    first.nextConnection!.connect(second.previousConnection!);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\n' +
        'skinparam componentStyle rectangle\n' +
        'component "Alpha" {\n}\n' +
        '"Alpha" --> "Beta"\n' +
        '"Beta" --> "Alpha"\n' +
        '@enduml\n',
    );
  });

  it("includes every disconnected top-level chain, not just one", () => {
    const componentA = workspace.newBlock("component_component");
    componentA.setFieldValue("A", "NAME");
    const componentB = workspace.newBlock("component_component");
    componentB.setFieldValue("B", "NAME");
    componentA.moveBy(0, 0);
    componentB.moveBy(0, 50);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle rectangle\ncomponent "A" {\n}\ncomponent "B" {\n}\n@enduml\n',
    );
  });

  it("defaults to rectangle when no component_style block is placed (FR-COMP-09)", () => {
    const component = workspace.newBlock("component_component");
    component.setFieldValue("Alpha", "NAME");

    expect(componentWorkspaceToCode(workspace)).toContain("skinparam componentStyle rectangle\n");
  });

  it("uses the chosen style instead of the default", () => {
    const style = workspace.newBlock("component_style");
    style.setFieldValue("uml2", "STYLE");

    expect(componentWorkspaceToCode(workspace)).toBe("@startuml\nskinparam componentStyle uml2\n@enduml\n");
  });

  it("hoists a component_style block nested inside a Component's body to the very front", () => {
    const outer = workspace.newBlock("component_component");
    outer.setFieldValue("Outer", "NAME");
    const style = workspace.newBlock("component_style");
    style.setFieldValue("uml1", "STYLE");
    outer.getInput("DO")!.connection!.connect(style.previousConnection!);

    expect(componentWorkspaceToCode(workspace)).toBe(
      '@startuml\nskinparam componentStyle uml1\ncomponent "Outer" {\n}\n@enduml\n',
    );
  });

  it("emits multiple component_style blocks in their original order, following PlantUML's last-wins semantics", () => {
    const first = workspace.newBlock("component_style");
    first.setFieldValue("uml1", "STYLE");
    const second = workspace.newBlock("component_style");
    second.setFieldValue("uml2", "STYLE");
    first.nextConnection!.connect(second.previousConnection!);

    expect(componentWorkspaceToCode(workspace)).toBe(
      "@startuml\nskinparam componentStyle uml1\nskinparam componentStyle uml2\n@enduml\n",
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
