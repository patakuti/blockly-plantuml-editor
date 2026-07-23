import { describe, expect, it } from "vitest";
import { parseSequencePlantUml, PlantUmlImportError, type SequenceImportedNode } from "../../src/import/sequenceImportParser";

describe("parseSequencePlantUml", () => {
  it("parses an empty diagram", () => {
    expect(parseSequencePlantUml("@startuml\n@enduml\n")).toEqual([]);
  });

  it("parses participant declarations", () => {
    const nodes = parseSequencePlantUml('@startuml\nparticipant "Alice"\nparticipant "Bob"\n@enduml\n');
    expect(nodes).toEqual([
      { kind: "participant", name: "Alice" },
      { kind: "participant", name: "Bob" },
    ]);
  });

  it("parses actor declarations, interleaved with participants (FR-SEQ-17)", () => {
    const nodes = parseSequencePlantUml('@startuml\nactor "Alice"\nparticipant "Bob"\nactor "Carol"\n@enduml\n');
    expect(nodes).toEqual([
      { kind: "actor", name: "Alice" },
      { kind: "participant", name: "Bob" },
      { kind: "actor", name: "Carol" },
    ]);
  });

  it("ignores a wrapping ```plantuml Markdown code fence", () => {
    const source = '```plantuml\n@startuml\nparticipant "Alice"\n"Alice" -> "Alice": ping\n@enduml\n```\n';
    expect(parseSequencePlantUml(source)).toEqual([
      { kind: "participant", name: "Alice" },
      { kind: "message", from: "Alice", to: "Alice", text: "ping" },
    ]);
  });

  it("ignores a wrapping bare ``` Markdown code fence", () => {
    const source = '```\nparticipant "Alice"\n```';
    expect(parseSequencePlantUml(source)).toEqual([{ kind: "participant", name: "Alice" }]);
  });

  it("parses a message", () => {
    const nodes = parseSequencePlantUml('"Alice" -> "Bob": ping\n');
    expect(nodes).toEqual([{ kind: "message", from: "Alice", to: "Bob", text: "ping" }]);
  });

  it("parses an alt with no else", () => {
    const nodes = parseSequencePlantUml('alt (ok)\n"Alice" -> "Bob": ping\nend\n');
    expect(nodes).toEqual([
      {
        kind: "alt",
        cond: "ok",
        body: [{ kind: "message", from: "Alice", to: "Bob", text: "ping" }],
        elseBranches: [],
      },
    ]);
  });

  it("parses an alt with multiple else branches", () => {
    const nodes = parseSequencePlantUml(
      'alt (a)\n"Alice" -> "Bob": one\nelse (b)\n"Bob" -> "Alice": two\nelse (c)\n"Alice" -> "Bob": three\nend\n',
    );
    expect(nodes).toEqual([
      {
        kind: "alt",
        cond: "a",
        body: [{ kind: "message", from: "Alice", to: "Bob", text: "one" }],
        elseBranches: [
          { cond: "b", body: [{ kind: "message", from: "Bob", to: "Alice", text: "two" }] },
          { cond: "c", body: [{ kind: "message", from: "Alice", to: "Bob", text: "three" }] },
        ],
      },
    ]);
  });

  it("parses opt", () => {
    const nodes = parseSequencePlantUml('opt (maybe)\n"Alice" -> "Bob": ping\nend\n');
    expect(nodes).toEqual([
      { kind: "opt", cond: "maybe", body: [{ kind: "message", from: "Alice", to: "Bob", text: "ping" }] },
    ]);
  });

  it("parses loop", () => {
    const nodes = parseSequencePlantUml('loop (3 times)\n"Alice" -> "Bob": ping\nend\n');
    expect(nodes).toEqual([
      { kind: "loop", cond: "3 times", body: [{ kind: "message", from: "Alice", to: "Bob", text: "ping" }] },
    ]);
  });

  it("parses nested containers", () => {
    const nodes = parseSequencePlantUml(
      'alt (retryable)\nloop (3 times)\n"Alice" -> "Bob": ping\nend\nend\n',
    );
    expect(nodes).toEqual([
      {
        kind: "alt",
        cond: "retryable",
        body: [
          { kind: "loop", cond: "3 times", body: [{ kind: "message", from: "Alice", to: "Bob", text: "ping" }] },
        ],
        elseBranches: [],
      },
    ]);
  });

  it("parses a one-line note (note left/right of X: text)", () => {
    const nodes = parseSequencePlantUml('note left of "Alice": remember this\n');
    expect(nodes).toEqual([{ kind: "note", side: "left", target: "Alice", text: "remember this" }]);
  });

  it("attaches a note-block to the previously parsed node", () => {
    const nodes = parseSequencePlantUml('"Alice" -> "Bob": ping\nnote right\nsome note\nend note\n');
    expect(nodes).toEqual([
      {
        kind: "message",
        from: "Alice",
        to: "Bob",
        text: "ping",
        comment: { text: "some note", direction: "right" },
      },
    ]);
  });

  it("falls back to raw lines when a note-block has no node to attach to", () => {
    const nodes = parseSequencePlantUml("note right\norphan\nend note\n");
    expect(nodes).toEqual([
      { kind: "raw", text: "note right" },
      { kind: "raw", text: "orphan" },
      { kind: "raw", text: "end note" },
    ]);
  });

  it("keeps unrecognized lines as raw nodes", () => {
    const nodes: SequenceImportedNode[] = parseSequencePlantUml("autonumber\ntitle Something\n");
    expect(nodes).toEqual([
      { kind: "raw", text: "autonumber" },
      { kind: "raw", text: "title Something" },
    ]);
  });

  it("throws PlantUmlImportError when alt's end is missing", () => {
    expect(() => parseSequencePlantUml('alt (a)\n"Alice" -> "Bob": ping\n')).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when opt's end is missing", () => {
    expect(() => parseSequencePlantUml('opt (a)\n"Alice" -> "Bob": ping\n')).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when loop's end is missing", () => {
    expect(() => parseSequencePlantUml('loop (a)\n"Alice" -> "Bob": ping\n')).toThrow(PlantUmlImportError);
  });

  it("throws PlantUmlImportError when end note is missing", () => {
    expect(() => parseSequencePlantUml('"Alice" -> "Bob": ping\nnote right\nunterminated\n')).toThrow(
      PlantUmlImportError,
    );
  });
});
