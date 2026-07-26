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

  it("generates a choice pseudostate declaration", () => {
    const choice = workspace.newBlock("state_choice");
    choice.setFieldValue("Choice1", "NAME");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Choice1 <<choice>>\n@enduml\n");
  });

  it("wraps a Choice's comment as an explicit note anchored to its own name", () => {
    const choice = workspace.newBlock("state_choice");
    choice.setFieldValue("Choice1", "NAME");
    choice.setCommentText("branch here");

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Choice1 <<choice>>\nnote right of Choice1\nbranch here\nend note\n@enduml\n",
    );
  });

  it("generates a fork pseudostate declaration", () => {
    const fork = workspace.newBlock("state_fork");
    fork.setFieldValue("Fork1", "NAME");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Fork1 <<fork>>\n@enduml\n");
  });

  it("generates a join pseudostate declaration", () => {
    const join = workspace.newBlock("state_join");
    join.setFieldValue("Join1", "NAME");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Join1 <<join>>\n@enduml\n");
  });

  it("wraps a Fork's comment as an explicit note anchored to its own name", () => {
    const fork = workspace.newBlock("state_fork");
    fork.setFieldValue("Fork1", "NAME");
    fork.setCommentText("splits here");

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Fork1 <<fork>>\nnote right of Fork1\nsplits here\nend note\n@enduml\n",
    );
  });

  it("generates transitions referencing bare shallow/deep history pseudostates", () => {
    const t1 = workspace.newBlock("state_transition");
    t1.setFieldValue("[H]", "FROM");
    t1.setFieldValue("State1", "TO");
    const t2 = workspace.newBlock("state_transition");
    t2.setFieldValue("State1", "FROM");
    t2.setFieldValue("[H*]", "TO");

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\n[H] --> State1\nState1 --> [H*]\n@enduml\n",
    );
  });

  it("generates transitions referencing a Composite State's history via the compound token", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Grouped", "NAME");
    const t1 = workspace.newBlock("state_transition");
    t1.setFieldValue("Grouped", "FROM");
    t1.setFieldValue("Grouped[H]", "TO");
    const t2 = workspace.newBlock("state_transition");
    t2.setFieldValue("Grouped[H*]", "FROM");
    t2.setFieldValue("Grouped", "TO");

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Grouped {\n}\nGrouped --> Grouped[H]\nGrouped[H*] --> Grouped\n@enduml\n",
    );
  });

  it("generates a Composite State with no extra regions exactly as before (no \"--\")", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Grouped", "NAME");
    expect(composite.saveExtraState!()).toEqual({ extraRegionCount: 0 });
    const sub = workspace.newBlock("state_state");
    sub.setFieldValue("Sub1", "NAME");
    composite.getInput("DO")!.connection!.connect(sub.previousConnection!);

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Grouped {\nstate Sub1\n}\n@enduml\n");
  });

  it("round-trips the region-count mutator state and generates concurrent regions separated by \"--\"", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    expect(composite.getInput("REGION1")).toBeNull();

    composite.loadExtraState!({ extraRegionCount: 1 });
    expect(composite.saveExtraState!()).toEqual({ extraRegionCount: 1 });
    expect(composite.getInput("REGION1")).not.toBeNull();

    const region0 = workspace.newBlock("state_state");
    region0.setFieldValue("A1", "NAME");
    composite.getInput("DO")!.connection!.connect(region0.previousConnection!);
    const region1 = workspace.newBlock("state_state");
    region1.setFieldValue("A2", "NAME");
    composite.getInput("REGION1")!.connection!.connect(region1.previousConnection!);

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Active {\nstate A1\n--\nstate A2\n}\n@enduml\n",
    );
  });

  it("generates three concurrent regions when the mutator count is increased to 2", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    composite.loadExtraState!({ extraRegionCount: 2 });
    expect(composite.getInput("REGION2")).not.toBeNull();

    const region2 = workspace.newBlock("state_state");
    region2.setFieldValue("A3", "NAME");
    composite.getInput("REGION2")!.connection!.connect(region2.previousConnection!);

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Active {\n--\n--\nstate A3\n}\n@enduml\n",
    );
  });

  it("generates a \"||\" region separator when selected (FR-STATE-17)", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    composite.loadExtraState!({ extraRegionCount: 1 });
    composite.setFieldValue("||", "SEPARATOR");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Active {\n||\n}\n@enduml\n");
  });

  it("applies the single chosen separator to every boundary, not just the first (PlantUML only honors the first anyway, 02_design.md 39.1a)", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    composite.loadExtraState!({ extraRegionCount: 2 });
    composite.setFieldValue("||", "SEPARATOR");

    expect(stateWorkspaceToCode(workspace)).toBe("@startuml\nstate Active {\n||\n||\n}\n@enduml\n");
  });

  it("keeps every boundary's displayed label in sync with the chosen separator", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    composite.loadExtraState!({ extraRegionCount: 2 });

    composite.setFieldValue("||", "SEPARATOR");

    expect(composite.getField("SEPARATOR_LABEL2")!.getText()).toBe("||");
  });

  it("preserves the chosen separator when the mutator's region count is increased", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    composite.loadExtraState!({ extraRegionCount: 1 });
    composite.setFieldValue("||", "SEPARATOR");

    composite.loadExtraState!({ extraRegionCount: 2 });

    expect(composite.getFieldValue("SEPARATOR")).toBe("||");
    expect(composite.getField("SEPARATOR_LABEL2")!.getText()).toBe("||");
  });

  it("allows a nested Composite State inside a concurrent region", () => {
    const composite = workspace.newBlock("state_composite");
    composite.setFieldValue("Active", "NAME");
    composite.loadExtraState!({ extraRegionCount: 1 });

    const inner = workspace.newBlock("state_composite");
    inner.setFieldValue("Inner", "NAME");
    const sub = workspace.newBlock("state_state");
    sub.setFieldValue("Sub1", "NAME");
    inner.getInput("DO")!.connection!.connect(sub.previousConnection!);
    composite.getInput("REGION1")!.connection!.connect(inner.previousConnection!);

    expect(stateWorkspaceToCode(workspace)).toBe(
      "@startuml\nstate Active {\n--\nstate Inner {\nstate Sub1\n}\n}\n@enduml\n",
    );
  });

  describe("state_description (FR-STATE-19, Round 32)", () => {
    it("generates a description line", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("State1", "NAME");
      const description = workspace.newBlock("state_description");
      description.setFieldValue("State1", "STATE");
      description.setFieldValue("this is a description", "TEXT");
      state.nextConnection!.connect(description.previousConnection!);

      expect(stateWorkspaceToCode(workspace)).toBe(
        "@startuml\nstate State1\nState1 : this is a description\n@enduml\n",
      );
    });

    it("generates multiple lines for multiple blocks referencing the same state", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("State1", "NAME");
      const d1 = workspace.newBlock("state_description");
      d1.setFieldValue("State1", "STATE");
      d1.setFieldValue("line1", "TEXT");
      const d2 = workspace.newBlock("state_description");
      d2.setFieldValue("State1", "STATE");
      d2.setFieldValue("line2", "TEXT");
      state.nextConnection!.connect(d1.previousConnection!);
      d1.nextConnection!.connect(d2.previousConnection!);

      expect(stateWorkspaceToCode(workspace)).toBe(
        "@startuml\nstate State1\nState1 : line1\nState1 : line2\n@enduml\n",
      );
    });
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

  it("treats a Choice's own name as a valid reference target", () => {
    const choice = workspace.newBlock("state_choice");
    choice.setFieldValue("Choice1", "NAME");
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("[*]", "FROM");
    transition.setFieldValue("Choice1", "TO");

    expect(validateStateWorkspace(workspace)).toEqual([]);
  });

  it("treats a Fork's and a Join's own name as a valid reference target", () => {
    const fork = workspace.newBlock("state_fork");
    fork.setFieldValue("Fork1", "NAME");
    const join = workspace.newBlock("state_join");
    join.setFieldValue("Join1", "NAME");
    const transition = workspace.newBlock("state_transition");
    transition.setFieldValue("Fork1", "FROM");
    transition.setFieldValue("Join1", "TO");

    expect(validateStateWorkspace(workspace)).toEqual([]);
  });

  describe("history pseudostate references (FR-STATE-16)", () => {
    it("treats bare [H] and [H*] as always-valid references", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("State1", "NAME");
      const t1 = workspace.newBlock("state_transition");
      t1.setFieldValue("[H]", "FROM");
      t1.setFieldValue("State1", "TO");
      const t2 = workspace.newBlock("state_transition");
      t2.setFieldValue("State1", "FROM");
      t2.setFieldValue("[H*]", "TO");

      expect(validateStateWorkspace(workspace)).toEqual([]);
    });

    it("treats <name>[H]/<name>[H*] as valid when the name is a declared Composite State", () => {
      const composite = workspace.newBlock("state_composite");
      composite.setFieldValue("Grouped", "NAME");
      const t1 = workspace.newBlock("state_transition");
      t1.setFieldValue("Grouped", "FROM");
      t1.setFieldValue("Grouped[H]", "TO");
      const t2 = workspace.newBlock("state_transition");
      t2.setFieldValue("Grouped[H*]", "FROM");
      t2.setFieldValue("Grouped", "TO");

      expect(validateStateWorkspace(workspace)).toEqual([]);
    });

    it("warns when <name>[H] references a Composite State that doesn't exist", () => {
      const transition = workspace.newBlock("state_transition");
      transition.setFieldValue("[*]", "FROM");
      transition.setFieldValue("Ghost[H]", "TO");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('TO="Ghost[H]"');
    });

    it("warns when <name>[H] references a plain State rather than a Composite State", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("Plain", "NAME");
      const transition = workspace.newBlock("state_transition");
      transition.setFieldValue("[*]", "FROM");
      transition.setFieldValue("Plain[H]", "TO");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('TO="Plain[H]"');
    });
  });

  describe("state_description reference validation (FR-STATE-20, Round 32)", () => {
    it("does not warn when STATE references a declared state", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("State1", "NAME");
      const description = workspace.newBlock("state_description");
      description.setFieldValue("State1", "STATE");

      expect(validateStateWorkspace(workspace)).toEqual([]);
    });

    it("warns when STATE references a state that doesn't exist", () => {
      const description = workspace.newBlock("state_description");
      description.setFieldValue("Ghost", "STATE");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].blockId).toBe(description.id);
      expect(warnings[0].message).toContain('STATE="Ghost"');
    });

    it("warns when STATE references \"[*]\" (unlike Transition, the pseudostate is not a valid target)", () => {
      const description = workspace.newBlock("state_description");
      description.setFieldValue("[*]", "STATE");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('STATE="[*]"');
    });

    it("warns with a dedicated message when STATE is unset (round 34)", () => {
      const description = workspace.newBlock("state_description");
      description.setFieldValue("", "STATE");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].blockId).toBe(description.id);
      expect(warnings[0].message).toBe(
        "Not attached to any state. Connect it directly after a State/Composite State block, or pick one manually.",
      );
    });
  });

  describe("NAME containing a space or a double quote (FR-STATE-13)", () => {
    it.each([
      ["state_state", "My State"],
      ["state_choice", "My Choice"],
      ["state_composite", "My Composite"],
      ["state_fork", "My Fork"],
      ["state_join", "My Join"],
    ])("warns on a %s name containing a space", (blockType, name) => {
      const block = workspace.newBlock(blockType);
      block.setFieldValue(name, "NAME");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].blockId).toBe(block.id);
      expect(warnings[0].message).toContain(name);
    });

    it("warns on a name containing a double quote", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue('My"State', "NAME");

      const warnings = validateStateWorkspace(workspace);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].blockId).toBe(state.id);
    });

    it("does not warn on a name with neither a space nor a double quote", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("MyState", "NAME");

      expect(validateStateWorkspace(workspace)).toEqual([]);
    });

    it("clears the warning once the name is fixed", () => {
      const state = workspace.newBlock("state_state");
      state.setFieldValue("My State", "NAME");
      expect(validateStateWorkspace(workspace)).toHaveLength(1);

      state.setFieldValue("MyState", "NAME");
      expect(validateStateWorkspace(workspace)).toEqual([]);
    });
  });
});
