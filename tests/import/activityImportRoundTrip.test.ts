import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineActivityBlocks } from "../../src/blocks/activity/blocks";
import { activityWorkspaceToCode } from "../../src/generators/activityGenerator";
import { parseActivityPlantUml } from "../../src/import/activityImportParser";
import { buildActivityWorkspace } from "../../src/import/activityImportBuilder";

defineActivityBlocks();

/** Parses `plantUml`, builds it into a fresh headless workspace, and regenerates it, to check that import + export round-trips losslessly for the given text. */
function roundTrip(plantUml: string): string {
  const workspace = new Blockly.Workspace();
  buildActivityWorkspace(workspace, parseActivityPlantUml(plantUml));
  return activityWorkspaceToCode(workspace);
}

describe("activity PlantUML import round-trip", () => {
  it("round-trips start/stop with no actions", () => {
    const text = "@startuml\nstart\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a chain of actions, including @ escaping", () => {
    const text = "@startuml\nstart\n:First;\n:Escape &#64;enduml here;\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips an if without an else", () => {
    const text = "@startuml\nstart\nif (x > 0) then (yes)\n:Then branch;\nendif\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips an if/else", () => {
    const text =
      "@startuml\nstart\n" +
      "if (x > 0) then (yes)\n:Then branch;\n" +
      "else (no)\n:Else branch;\n" +
      "endif\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips custom then/else labels", () => {
    const text =
      "@startuml\nstart\n" +
      "if (logged in?) then (yes please)\n:Show dashboard;\n" +
      "else (nope)\n:Show login;\n" +
      "endif\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a while loop", () => {
    const text = "@startuml\nstart\nwhile (x < 10)\n:increment x;\nendwhile\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a repeat loop", () => {
    const text = "@startuml\nstart\nrepeat\n:increment x;\nrepeat while (x < 10)\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a two-branch fork", () => {
    const text = "@startuml\nstart\nfork\n:branch A;\nfork again\n:branch B;\nend fork\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a three-branch fork", () => {
    const text =
      "@startuml\nstart\n" +
      "fork\n:branch A;\nfork again\n:branch B;\nfork again\n:branch C;\n" +
      "end fork\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips nested containers (fork branch containing an if containing a while)", () => {
    const text =
      "@startuml\nstart\n" +
      "fork\n" +
      "if (x > 0) then (yes)\nwhile (x < 10)\n:increment x;\nendwhile\nendif\n" +
      "fork again\n:branch B;\n" +
      "end fork\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips nested partitions", () => {
    const text =
      "@startuml\nstart\npartition Outer {\npartition Inner {\n:Do something;\n}\n}\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips swimlane switches without a start pin", () => {
    const text = "@startuml\n|A|\n|B|\nstart\n|A|\n:a1;\n|B|\n:b1;\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a block comment as a PlantUML note", () => {
    const text = "@startuml\nstart\n:Do something;\nnote right\na helpful note\nend note\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a left-facing note", () => {
    const text = "@startuml\nstart\n:Do something;\nnote left\na helpful note\nend note\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves unrecognized lines verbatim as raw blocks, including on re-export", () => {
    const text = "@startuml\nstart\nskinparam handwritten true\n:step;\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves a manually-written raw line placed inside an if branch", () => {
    const text = "@startuml\nstart\nif (x > 0) then (yes)\n' a plain PlantUML comment\n:step;\nendif\nstop\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });
});
