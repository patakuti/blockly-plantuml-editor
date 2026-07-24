import { describe, expect, it } from "vitest";
import { collectAmbiguousQuoteNames, parseComponentPlantUml, PlantUmlImportError } from "../../src/import/componentImportParser";

describe("parseComponentPlantUml", () => {
  it("parses a leaf component, stripping @startuml/@enduml", () => {
    const source = '@startuml\ncomponent "Alpha" {\n}\n@enduml\n';
    expect(parseComponentPlantUml(source)).toEqual([{ kind: "component", name: "Alpha", body: [] }]);
  });

  it("parses a nested component", () => {
    const source = 'component "Outer" {\ncomponent "Inner" {\n}\n}';
    expect(parseComponentPlantUml(source)).toEqual([
      {
        kind: "component",
        name: "Outer",
        body: [{ kind: "component", name: "Inner", body: [] }],
      },
    ]);
  });

  it("parses a dependency without a label", () => {
    const source = '"Alpha" --> "Beta"';
    expect(parseComponentPlantUml(source)).toEqual([{ kind: "dependency", from: "Alpha", to: "Beta" }]);
  });

  it("parses a dependency with a label", () => {
    const source = '"Alpha" --> "Beta" : uses';
    expect(parseComponentPlantUml(source)).toEqual([
      { kind: "dependency", from: "Alpha", to: "Beta", text: "uses" },
    ]);
  });

  it("unescapes &#64; back to @ in names and labels", () => {
    const source = 'component "Escape&#64;enduml" {\n}\n"A" --> "B" : Escape &#64;enduml here';
    expect(parseComponentPlantUml(source)).toEqual([
      { kind: "component", name: "Escape@enduml", body: [] },
      { kind: "dependency", from: "A", to: "B", text: "Escape @enduml here" },
    ]);
  });

  it("skips blank lines", () => {
    const source = 'component "A" {\n}\n\n\n"A" --> "B"\n\n';
    expect(parseComponentPlantUml(source)).toEqual([
      { kind: "component", name: "A", body: [] },
      { kind: "dependency", from: "A", to: "B" },
    ]);
  });

  it("keeps unrecognized lines as raw nodes, including note blocks", () => {
    const source = 'component "A" {\n}\nnote right of A\nnot supported\nend note\n"A" --> "A"';
    expect(parseComponentPlantUml(source)).toEqual([
      { kind: "component", name: "A", body: [] },
      { kind: "raw", text: "note right of A" },
      { kind: "raw", text: "not supported" },
      { kind: "raw", text: "end note" },
      { kind: "dependency", from: "A", to: "A" },
    ]);
  });

  it("throws PlantUmlImportError when a component's closing brace is missing", () => {
    expect(() => parseComponentPlantUml('component "Outer" {\ncomponent "Inner" {\n}\n')).toThrow(
      PlantUmlImportError,
    );
  });
});

describe("collectAmbiguousQuoteNames (FR-IMPORT-08)", () => {
  it("returns an empty array when no name contains a single quote", () => {
    const nodes = parseComponentPlantUml('component "Alpha" {\n}\n"Alpha" --> "Alpha"');
    expect(collectAmbiguousQuoteNames(nodes)).toEqual([]);
  });

  it("detects a component name containing a single quote, including nested components", () => {
    const nodes = parseComponentPlantUml('component "O\'Brien" {\ncomponent "D\'Angelo" {\n}\n}');
    expect(collectAmbiguousQuoteNames(nodes)).toEqual(["O'Brien", "D'Angelo"]);
  });

  it("detects a dependency's FROM/TO containing a single quote", () => {
    const nodes = parseComponentPlantUml('"O\'Brien" --> "Beta"');
    expect(collectAmbiguousQuoteNames(nodes)).toEqual(["O'Brien"]);
  });

  it("does not flag a dependency's free-text label containing a single quote", () => {
    const nodes = parseComponentPlantUml('"Alpha" --> "Beta" : it\'s fine');
    expect(collectAmbiguousQuoteNames(nodes)).toEqual([]);
  });

  it("deduplicates repeated occurrences of the same ambiguous name", () => {
    const nodes = parseComponentPlantUml('component "O\'Brien" {\n}\n"O\'Brien" --> "O\'Brien"');
    expect(collectAmbiguousQuoteNames(nodes)).toEqual(["O'Brien"]);
  });
});
