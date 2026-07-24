import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineComponentBlocks } from "../../src/blocks/component/blocks";
import { componentWorkspaceToCode } from "../../src/generators/componentGenerator";
import { parseComponentPlantUml } from "../../src/import/componentImportParser";
import { buildComponentWorkspace } from "../../src/import/componentImportBuilder";

defineComponentBlocks();

/** Parses `plantUml`, builds it into a fresh headless workspace, and regenerates it, to check that import + export round-trips losslessly for the given text. */
function roundTrip(plantUml: string): string {
  const workspace = new Blockly.Workspace();
  buildComponentWorkspace(workspace, parseComponentPlantUml(plantUml));
  return componentWorkspaceToCode(workspace);
}

describe("component PlantUML import round-trip", () => {
  it("round-trips an empty diagram", () => {
    const text = "@startuml\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a leaf component", () => {
    const text = '@startuml\ncomponent "Alpha" {\n}\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a nested component", () => {
    const text = '@startuml\ncomponent "Outer" {\ncomponent "Inner" {\n}\n}\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a dependency without a label", () => {
    const text = '@startuml\n"Alpha" --> "Beta"\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a dependency with a label", () => {
    const text = '@startuml\n"Alpha" --> "Beta" : uses\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips multiple disconnected top-level chains", () => {
    const text = '@startuml\ncomponent "A" {\n}\ncomponent "B" {\n}\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a full diagram combining nested components and dependencies", () => {
    const text =
      "@startuml\n" +
      'component "Frontend" {\n' +
      'component "UI" {\n}\n' +
      "}\n" +
      'component "Backend" {\n}\n' +
      '"Frontend" --> "Backend" : calls\n' +
      "@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves unrecognized lines verbatim as raw blocks, including on re-export", () => {
    const text = '@startuml\ncomponent "A" {\n}\nskinparam handwritten true\n"A" --> "A"\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });
});
