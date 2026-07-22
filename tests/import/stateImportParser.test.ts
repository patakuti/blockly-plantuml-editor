import { describe, expect, it } from "vitest";
import { parseStatePlantUml, PlantUmlImportError } from "../../src/import/stateImportParser";

describe("parseStatePlantUml", () => {
  it("parses a state declaration and a transition, stripping @startuml/@enduml", () => {
    const source = "@startuml\nstate State1\n[*] --> State1\n@enduml\n";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "State1" },
      { kind: "transition", from: "[*]", to: "State1" },
    ]);
  });

  it("parses a transition with a label", () => {
    const source = "State1 --> State2 : go";
    expect(parseStatePlantUml(source)).toEqual([{ kind: "transition", from: "State1", to: "State2", label: "go" }]);
  });

  it("parses a transition to the end pseudostate", () => {
    const source = "State1 --> [*]";
    expect(parseStatePlantUml(source)).toEqual([{ kind: "transition", from: "State1", to: "[*]" }]);
  });

  it("parses a composite state, including nested composite states", () => {
    const source = "state Outer {\nstate Inner {\nstate Leaf\n}\n}";
    expect(parseStatePlantUml(source)).toEqual([
      {
        kind: "composite",
        name: "Outer",
        body: [
          {
            kind: "composite",
            name: "Inner",
            body: [{ kind: "state", name: "Leaf" }],
          },
        ],
      },
    ]);
  });

  it("unescapes &#64; back to @ in names and labels", () => {
    const source = "state Escape&#64;enduml\nA --> B : Escape &#64;enduml here";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "Escape@enduml" },
      { kind: "transition", from: "A", to: "B", label: "Escape @enduml here" },
    ]);
  });

  it("skips blank lines", () => {
    const source = "state A\n\n\nA --> B\n\n";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "A" },
      { kind: "transition", from: "A", to: "B" },
    ]);
  });

  it("keeps unrecognized lines as raw nodes", () => {
    const source = "state A\nskinparam handwritten true\nA --> B";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "A" },
      { kind: "raw", text: "skinparam handwritten true" },
      { kind: "transition", from: "A", to: "B" },
    ]);
  });

  it("attaches a note to the immediately preceding matching state", () => {
    const source = "state A\nnote right of A\na helpful note\nend note";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "A", comment: { text: "a helpful note", direction: "right" } },
    ]);
  });

  it("attaches a multi-line left-facing note to a composite state", () => {
    const source = "state A {\nstate B\n}\nnote left of A\nline one\nline two\nend note";
    expect(parseStatePlantUml(source)).toEqual([
      {
        kind: "composite",
        name: "A",
        body: [{ kind: "state", name: "B" }],
        comment: { text: "line one\nline two", direction: "left" },
      },
    ]);
  });

  it("falls back to raw lines when there is no preceding statement", () => {
    const source = "note right of A\norphan note\nend note";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "raw", text: "note right of A" },
      { kind: "raw", text: "orphan note" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("falls back to raw lines when the anchor name does not match the preceding statement", () => {
    const source = "state A\nnote right of B\nmismatched\nend note";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "A" },
      { kind: "raw", text: "note right of B" },
      { kind: "raw", text: "mismatched" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("falls back to raw lines when the preceding statement is a transition", () => {
    const source = "[*] --> A\nnote right of A\nnot attachable\nend note";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "transition", from: "[*]", to: "A" },
      { kind: "raw", text: "note right of A" },
      { kind: "raw", text: "not attachable" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("falls back to raw lines when the preceding statement already has a note", () => {
    const source = "state A\nnote right of A\nfirst\nend note\nnote right of A\nsecond\nend note";
    expect(parseStatePlantUml(source)).toEqual([
      { kind: "state", name: "A", comment: { text: "first", direction: "right" } },
      { kind: "raw", text: "note right of A" },
      { kind: "raw", text: "second" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("throws PlantUmlImportError when a composite state's closing brace is missing", () => {
    expect(() => parseStatePlantUml("state Outer {\nstate A\n")).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when end note is missing", () => {
    expect(() => parseStatePlantUml("state A\nnote right of A\nunterminated\n")).toThrow(PlantUmlImportError);
  });
});
