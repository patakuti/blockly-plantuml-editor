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

  it("round-trips transitions referencing bare shallow/deep history pseudostates", () => {
    const text = "@startuml\n[H] --> State1\nState1 --> [H*]\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips transitions referencing a Composite State's history via the compound token", () => {
    const text = "@startuml\nstate Grouped {\n}\nGrouped --> Grouped[H]\nGrouped[H*] --> Grouped\n@enduml\n";
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

  it("round-trips a choice pseudostate", () => {
    const text = "@startuml\nstate Choice1 <<choice>>\n[*] --> Choice1\nChoice1 --> State1 : yes\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips fork/join pseudostates", () => {
    const text =
      "@startuml\n" +
      "state Fork1 <<fork>>\n" +
      "[*] --> Fork1\n" +
      "Fork1 --> StateA\n" +
      "Fork1 --> StateB\n" +
      "StateA --> Join1\n" +
      "StateB --> Join1\n" +
      "state Join1 <<join>>\n" +
      "Join1 --> [*]\n" +
      "@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a fork's note", () => {
    const text = "@startuml\nstate Fork1 <<fork>>\nnote right of Fork1\nsplits here\nend note\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a composite state with two concurrent regions", () => {
    const text = "@startuml\nstate Active {\nstate A1\n--\nstate A2\n}\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a composite state with three concurrent regions, including a nested composite", () => {
    const text =
      "@startuml\n" +
      "state Active {\n" +
      "state A1\n" +
      "--\n" +
      "state Inner {\nstate Sub1\n}\n" +
      "--\n" +
      "state A3\n" +
      "}\n" +
      "@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a composite state with a \"||\" region separator", () => {
    const text = "@startuml\nstate Active {\nstate A1\n||\nstate A2\n}\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("normalizes a mixed \"--\"/\"||\" source to the first separator on re-export (only the first affects PlantUML's rendering, 02_design.md 39.1a)", () => {
    const text = "@startuml\nstate Active {\nstate A1\n--\nstate A2\n||\nstate A3\n}\n@enduml\n";
    const normalized = "@startuml\nstate Active {\nstate A1\n--\nstate A2\n--\nstate A3\n}\n@enduml\n";
    expect(roundTrip(text)).toBe(normalized);
  });
});
