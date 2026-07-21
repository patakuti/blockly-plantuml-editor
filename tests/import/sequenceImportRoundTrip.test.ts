import { describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineSequenceBlocks } from "../../src/blocks/sequence/blocks";
import { sequenceWorkspaceToCode } from "../../src/generators/sequenceGenerator";
import { parseSequencePlantUml } from "../../src/import/sequenceImportParser";
import { buildSequenceWorkspace } from "../../src/import/sequenceImportBuilder";

defineSequenceBlocks();

/** Parses `plantUml`, builds it into a fresh headless workspace, and regenerates it, to check that import + export round-trips losslessly for the given text. */
function roundTrip(plantUml: string): string {
  const workspace = new Blockly.Workspace();
  buildSequenceWorkspace(workspace, parseSequencePlantUml(plantUml));
  return sequenceWorkspaceToCode(workspace);
}

describe("sequence PlantUML import round-trip", () => {
  it("round-trips an empty diagram", () => {
    const text = "@startuml\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips participants and a message", () => {
    const text = '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": ping\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips an alt with no else", () => {
    const text = '@startuml\nparticipant "Alice"\nparticipant "Bob"\nalt (ok)\n"Alice" -> "Bob": ping\nend\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips an alt with multiple else branches", () => {
    const text =
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n' +
      'alt (a)\n"Alice" -> "Bob": one\n' +
      'else (b)\n"Bob" -> "Alice": two\n' +
      'else (c)\n"Alice" -> "Bob": three\n' +
      "end\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips opt", () => {
    const text = '@startuml\nparticipant "Alice"\nopt (maybe)\n"Alice" -> "Alice": ping\nend\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips loop", () => {
    const text = '@startuml\nloop (3 times)\n"" -> "": ping\nend\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips nested containers", () => {
    const text =
      '@startuml\nparticipant "Alice"\nparticipant "Bob"\n' +
      "alt (retryable)\n" +
      'loop (3 times)\n"Alice" -> "Bob": ping\nend\n' +
      "end\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a one-line note", () => {
    const text = '@startuml\nparticipant "Alice"\nnote left of "Alice": remember this\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips an unrecognized line as a raw line, verbatim", () => {
    const text = "@startuml\nautonumber\ntitle Something\n@enduml\n";
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a message with @ escaping", () => {
    const text = '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": Escape &#64;enduml here\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });

  it("round-trips a comment attached via note-block form", () => {
    const text = '@startuml\nparticipant "Alice"\nparticipant "Bob"\n"Alice" -> "Bob": ping\nnote right\nremember this\nend note\n@enduml\n';
    expect(roundTrip(text)).toBe(text);
  });
});
