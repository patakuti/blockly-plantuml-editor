import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineStateBlocks } from "../../src/blocks/state/blocks";
import { stateWorkspaceToCode } from "../../src/generators/stateGenerator";
import { validateStateWorkspace } from "../../src/blocks/state/validation";

defineStateBlocks();

describe("stateWorkspaceToCode", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("returns an empty shell for an empty workspace", () => {
    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\n@enduml\n");
  });

  it("generates a state declaration", () => {
    const state = workspace.newBlock("state_state");
    state.setFieldValue("Idle", "NAME");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Idle\n@enduml\n");
  });

  it("generates a transition with a label", () => {
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("State1", "TO");
    transition.setFieldValue("go", "LABEL");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\n[*] --> State1 : go\n@enduml\n");
  });

  it("omits the label when empty", () => {
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("State1", "FROM");
    transition.setFieldValue("[*]", "TO");
    transition.setFieldValue("", "LABEL");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nState1 --> [*]\n@enduml\n");
  });

  it("generates a nested composite state", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Outer", "NAME");
    const inner = workspace.newBlock("state_composite");
    inner.setFieldValue("Inner", "NAME");
    const sub = workspace.newBlock("state_state");
    sub.setFieldValue("Sub1", "NAME");

    inner.getInput("DO")!.connection!.connect(sub.previousConnection!);
    composite.getInput("DO")!.connection!.connect(inner.previousConnection!);

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Outer {\nstate Inner {\nstate Sub1\n}\n}\n@enduml\n",
    );
  });

  it("emits a raw line verbatim and unescaped", () => {
    const raw = workspace.newBlock("state_raw_line");
    raw.setFieldValue("[*] --> Choice1", "TEXT");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\n[*] --> Choice1\n@enduml\n");
  });

  it("includes every disconnected top-level chain, not just one", () => {
    const stateA = workspace.newBlock("state_state");
    stateA.setFieldValue("A", "NAME");
    const stateB = workspace.newBlock("state_state");
    stateB.setFieldValue("B", "NAME");
    stateA.moveBy(0, 0);
    stateB.moveBy(0, 50);

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate A\nstate B\n@enduml\n");
  });

  it("wraps a State's comment as an explicit note anchored to its own name", () => {
    const state = workspace.newBlock("state_state");
    state.setFieldValue("Idle", "NAME");
    state.setCommentText("waiting for input");

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Idle\nnote right of Idle\nwaiting for input\nend note\n@enduml\n",
    );
  });

  it("wraps a Composite State's comment the same way, honoring left direction", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Grouped", "NAME");
    composite.setCommentText("grouped work");
    composite.data = "left";

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Grouped {\n}\nnote left of Grouped\ngrouped work\nend note\n@enduml\n",
    );
  });
});

describe("validateStateWorkspace", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("does not warn when FROM/TO reference declared states", () => {
    const state = workspace.newBlock("state_state");
    state.setFieldValue("State1", "NAME");
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("State1", "TO");

    expect(validateStateWorkspace(workspace)).toEqual([]);
  });

  it("warns when FROM/TO reference a state that doesn't exist", () => {
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("Ghost", "FROM");
    transition.setFieldValue("[*]", "TO");

    const warnings = validateStateWorkspace(workspace);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].blockId).toBe(transition.id);
    expect(warnings[0].message).toContain('FROM="Ghost"');
  });

  it("treats a Composite State's own name as a valid reference target", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Grouped", "NAME");
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("Grouped", "TO");

    expect(validateStateWorkspace(workspace)).toEqual([]);
  });
});
