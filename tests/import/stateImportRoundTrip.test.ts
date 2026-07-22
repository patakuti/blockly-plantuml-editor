import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import { stateWorkspaceToCode } from "../../src/generators/stateGenerator";
import { parseStatePlantUml } from "../../src/import/stateImportParser";
import { buildStateWorkspace } from "../../src/import/stateImportBuilder";

defineStateBlocks();

/** Parses `plantUml`, builds it into a fresh headless workspace, and regenerates it, to check that import + export round-trips losslessly for the given text. */
function roundTrip(plantUml: string): string {
  const workspace = new Blockly.Workspace();
  buildStateWorkspace(workspace, parseStatePlantUml(plantUml));
  return stateWorkspaceToCode(workspace);
}

describe("state PlantUML import round-trip", () => {
  it("round-trips an empty diagram", () => {
    const text = "@startuml\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a state declaration", () => {
    const text = "@startuml\nstate Idle\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a transition with a label", () => {
    const text = "@startuml\n[*] --> State1 : go\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a transition without a label", () => {
    const text = "@startuml\nState1 --> [*]\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a nested composite state", () => {
    const text = "@startuml\nstate Outer {\nstate Inner {\nstate Sub1\n}\n}\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips multiple disconnected top-level chains", () => {
    const text = "@startuml\nstate A\nstate B\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a State's note", () => {
    const text = "@startuml\nstate Idle\nnote right of Idle\nwaiting for input\nend note\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a Composite State's note, honoring left direction", () => {
    const text = "@startuml\nstate Grouped {\n}\nnote left of Grouped\ngrouped work\nend note\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a full diagram combining states, transitions, and a composite", () => {
    const text =
      "@startuml\n" +
      "state Idle\n" +
      "[*] --> Idle\n" +
      "state Working {\nstate Step1\n}\n" +
      "Idle --> Working : start\n" +
      "Working --> [*]\n" +
      "@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves unrecognized lines verbatim as raw blocks, including on re-export", () => {
    const text = "@startuml\nstate A\nskinparam handwritten true\nA --> B\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });
});
