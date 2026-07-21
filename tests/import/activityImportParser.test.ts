import { describe, expect, it } from "vitest";
import { parseActivityPlantUml, PlantUmlImportError } from "../../src/import/activityImportParser";

describe("parseActivityPlantUml", () => {
  it("parses start/action/stop, stripping @startuml/@enduml", () => {
    const source = "@startuml\nstart\n:Do something;\nstop\n@enduml\n";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "start" },
      { kind: "action", text: "Do something" },
      { kind: "stop" },
    ]);
  });

  it("unescapes &#64; back to @ in action text", () => {
    const source = ":Escape &#64;enduml here;";
    expect(parseActivityPlantUml(source)).toEqual([{ kind: "action", text: "Escape @enduml here" }]);
  });

  it("skips blank lines", () => {
    const source = "start\n\n\n:step;\n\nstop";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "start" },
      { kind: "action", text: "step" },
      { kind: "stop" },
    ]);
  });

  it("parses an if without an else", () => {
    const source = "if (x > 0) then (yes)\n:Then branch;\nendif";
    expect(parseActivityPlantUml(source)).toEqual([
      {
        kind: "if",
        cond: "x > 0",
        thenLabel: "yes",
        thenBody: [{ kind: "action", text: "Then branch" }],
      },
    ]);
  });

  it("parses an if/else", () => {
    const source = "if (x > 0) then (yes)\n:Then branch;\nelse (no)\n:Else branch;\nendif";
    expect(parseActivityPlantUml(source)).toEqual([
      {
        kind: "if",
        cond: "x > 0",
        thenLabel: "yes",
        thenBody: [{ kind: "action", text: "Then branch" }],
        elseLabel: "no",
        elseBody: [{ kind: "action", text: "Else branch" }],
      },
    ]);
  });

  it("parses a while loop", () => {
    const source = "while (x < 10)\n:increment x;\nendwhile";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "while", cond: "x < 10", body: [{ kind: "action", text: "increment x" }] },
    ]);
  });

  it("parses a repeat loop", () => {
    const source = "repeat\n:increment x;\nrepeat while (x < 10)";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "repeat", cond: "x < 10", body: [{ kind: "action", text: "increment x" }] },
    ]);
  });

  it("parses a fork with two branches", () => {
    const source = "fork\n:branch A;\nfork again\n:branch B;\nend fork";
    expect(parseActivityPlantUml(source)).toEqual([
      {
        kind: "fork",
        branches: [[{ kind: "action", text: "branch A" }], [{ kind: "action", text: "branch B" }]],
      },
    ]);
  });

  it("parses a fork with three branches", () => {
    const source = "fork\n:A;\nfork again\n:B;\nfork again\n:C;\nend fork";
    const result = parseActivityPlantUml(source);
    expect(result).toEqual([
      {
        kind: "fork",
        branches: [[{ kind: "action", text: "A" }], [{ kind: "action", text: "B" }], [{ kind: "action", text: "C" }]],
      },
    ]);
  });

  it("parses nested containers (fork branch containing an if containing a while)", () => {
    const source =
      "fork\n" +
      "if (x > 0) then (yes)\nwhile (x < 10)\n:increment x;\nendwhile\nendif\n" +
      "fork again\n:branch B;\n" +
      "end fork";
    expect(parseActivityPlantUml(source)).toEqual([
      {
        kind: "fork",
        branches: [
          [
            {
              kind: "if",
              cond: "x > 0",
              thenLabel: "yes",
              thenBody: [{ kind: "while", cond: "x < 10", body: [{ kind: "action", text: "increment x" }] }],
            },
          ],
          [{ kind: "action", text: "branch B" }],
        ],
      },
    ]);
  });

  it("parses a partition, including nested partitions", () => {
    const source = "partition Outer {\npartition Inner {\n:Do something;\n}\n}";
    expect(parseActivityPlantUml(source)).toEqual([
      {
        kind: "partition",
        name: "Outer",
        body: [
          {
            kind: "partition",
            name: "Inner",
            body: [{ kind: "action", text: "Do something" }],
          },
        ],
      },
    ]);
  });

  it("parses swimlane markers", () => {
    const source = "|Team Alpha|\n:Do something;";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "swimlane", name: "Team Alpha" },
      { kind: "action", text: "Do something" },
    ]);
  });

  it("attaches a note to the immediately preceding statement", () => {
    const source = ":Do something;\nnote right\na helpful note\nend note";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "action", text: "Do something", comment: { text: "a helpful note", direction: "right" } },
    ]);
  });

  it("attaches a multi-line left-facing note", () => {
    const source = ":Do something;\nnote left\nline one\nline two\nend note";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "action", text: "Do something", comment: { text: "line one\nline two", direction: "left" } },
    ]);
  });

  it("falls back to raw lines when a note has no preceding statement", () => {
    const source = "note right\norphan note\nend note";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "raw", text: "note right" },
      { kind: "raw", text: "orphan note" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("falls back to raw lines when the preceding statement already has a note", () => {
    const source = ":step;\nnote right\nfirst\nend note\nnote right\nsecond\nend note";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "action", text: "step", comment: { text: "first", direction: "right" } },
      { kind: "raw", text: "note right" },
      { kind: "raw", text: "second" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("keeps unrecognized lines as raw nodes", () => {
    const source = "start\nskinparam handwritten true\n:step;\nstop";
    expect(parseActivityPlantUml(source)).toEqual([
      { kind: "start" },
      { kind: "raw", text: "skinparam handwritten true" },
      { kind: "action", text: "step" },
      { kind: "stop" },
    ]);
  });

  it("throws PlantUmlImportError when endif is missing", () => {
    expect(() => parseActivityPlantUml("if (x > 0) then (yes)\n:a;\n")).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when end fork is missing", () => {
    expect(() => parseActivityPlantUml("fork\n:a;\nfork again\n:b;\n")).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when a partition's closing brace is missing", () => {
    expect(() => parseActivityPlantUml("partition P {\n:a;\n")).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when repeat while is missing", () => {
    expect(() => parseActivityPlantUml("repeat\n:a;\n")).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when end note is missing", () => {
    expect(() => parseActivityPlantUml(":a;\nnote right\nunterminated\n")).toThrow(PlantUmlImportError);
  });
});
