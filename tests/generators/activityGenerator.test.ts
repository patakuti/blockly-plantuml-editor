import { beforeEach, describe, expect, it } from "vitest";
import * as Blockly from "blockly/core";
import { defineActivityBlocks } from "../../src/blocks/activity/blocks";
import { activityWorkspaceToCode } from "../../src/generators/activityGenerator";

defineActivityBlocks();

function connectChain(...blocks: Blockly.Block[]): void {
  for (let i = 0; i < blocks.length - 1; i++) {
    const next = blocks[i].nextConnection;
    const prev = blocks[i + 1].previousConnection;
    if (!next || !prev) throw new Error("blocks in chain must have next/previous connections");
    next.connect(prev);
  }
}

describe("activityWorkspaceToCode", () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  it("generates start/stop with no actions in between", () => {
    const start = workspace.newBlock("activity_start");
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, stop);

    expect(activityWorkspaceToCode(workspace)).toBe("@startuml\nstart\nstop\n@enduml\n");
  });

  it("generates a single action between start and stop", () => {
    const start = workspace.newBlock("activity_start");
    const action = workspace.newBlock("activity_action");
    action.setFieldValue("Do something", "TEXT");
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, action, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n:Do something;\nstop\n@enduml\n",
    );
  });

  it("chains multiple actions in order", () => {
    const start = workspace.newBlock("activity_start");
    const first = workspace.newBlock("activity_action");
    first.setFieldValue("First", "TEXT");
    const second = workspace.newBlock("activity_action");
    second.setFieldValue("Second", "TEXT");
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, first, second, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n:First;\n:Second;\nstop\n@enduml\n",
    );
  });

  it("escapes @ to prevent breaking out of the diagram (verified against the PlantUML server)", () => {
    const start = workspace.newBlock("activity_start");
    const action = workspace.newBlock("activity_action");
    action.setFieldValue("Escape @enduml here", "TEXT");
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, action, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n:Escape &#64;enduml here;\nstop\n@enduml\n",
    );
  });

  it("wraps a block comment as a PlantUML note", () => {
    const start = workspace.newBlock("activity_start");
    const action = workspace.newBlock("activity_action");
    action.setFieldValue("Do something", "TEXT");
    action.setCommentText("a helpful note");
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, action, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n:Do something;\nnote right\na helpful note\nend note\nstop\n@enduml\n",
    );
  });

  it("wraps a block comment as a left-facing PlantUML note when block.data is \"left\"", () => {
    const start = workspace.newBlock("activity_start");
    const action = workspace.newBlock("activity_action");
    action.setFieldValue("Do something", "TEXT");
    action.setCommentText("a helpful note");
    action.data = "left";
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, action, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n:Do something;\nnote left\na helpful note\nend note\nstop\n@enduml\n",
    );
  });

  it("skips disabled blocks", () => {
    const start = workspace.newBlock("activity_start");
    const action = workspace.newBlock("activity_action");
    action.setFieldValue("Skip me", "TEXT");
    action.setDisabledReason(true, "test");
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, action, stop);

    expect(activityWorkspaceToCode(workspace)).toBe("@startuml\nstart\nstop\n@enduml\n");
  });

  it("returns an empty shell when there is no start block", () => {
    expect(activityWorkspaceToCode(workspace)).toBe("@startuml\n@enduml\n");
  });

  it("generates an if without an else branch by default", () => {
    const start = workspace.newBlock("activity_start");
    const ifBlock = workspace.newBlock("activity_if");
    ifBlock.setFieldValue("x > 0", "COND");
    const thenAction = workspace.newBlock("activity_action");
    thenAction.setFieldValue("Then branch", "TEXT");
    ifBlock.getInput("DO0")!.connection!.connect(thenAction.previousConnection!);
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, ifBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\nif (x > 0) then (yes)\n:Then branch;\nendif\nstop\n@enduml\n",
    );
  });

  it("generates an if/else branch once the mutator adds an else", () => {
    const start = workspace.newBlock("activity_start");
    const ifBlock = workspace.newBlock("activity_if");
    ifBlock.setFieldValue("x > 0", "COND");
    ifBlock.loadExtraState!({ elseCount: 1 });

    const thenAction = workspace.newBlock("activity_action");
    thenAction.setFieldValue("Then branch", "TEXT");
    ifBlock.getInput("DO0")!.connection!.connect(thenAction.previousConnection!);

    const elseAction = workspace.newBlock("activity_action");
    elseAction.setFieldValue("Else branch", "TEXT");
    ifBlock.getInput("ELSE")!.connection!.connect(elseAction.previousConnection!);

    const stop = workspace.newBlock("activity_stop");
    connectChain(start, ifBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n" +
        "if (x > 0) then (yes)\n:Then branch;\n" +
        "else (no)\n:Else branch;\n" +
        "endif\nstop\n@enduml\n",
    );
  });

  it("round-trips the else mutator state via save/loadExtraState", () => {
    const ifBlock = workspace.newBlock("activity_if");
    expect(ifBlock.saveExtraState!()).toEqual({ elseCount: 0 });
    expect(ifBlock.getInput("ELSE")).toBeNull();

    ifBlock.loadExtraState!({ elseCount: 1 });
    expect(ifBlock.saveExtraState!()).toEqual({ elseCount: 1 });
    expect(ifBlock.getInput("ELSE")).not.toBeNull();

    ifBlock.loadExtraState!({ elseCount: 0 });
    expect(ifBlock.getInput("ELSE")).toBeNull();
  });

  it("generates a while loop", () => {
    const start = workspace.newBlock("activity_start");
    const whileBlock = workspace.newBlock("activity_while");
    whileBlock.setFieldValue("x < 10", "COND");
    const body = workspace.newBlock("activity_action");
    body.setFieldValue("increment x", "TEXT");
    whileBlock.getInput("DO")!.connection!.connect(body.previousConnection!);
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, whileBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\nwhile (x < 10)\n:increment x;\nendwhile\nstop\n@enduml\n",
    );
  });

  it("generates a repeat loop", () => {
    const start = workspace.newBlock("activity_start");
    const repeatBlock = workspace.newBlock("activity_repeat");
    repeatBlock.setFieldValue("x < 10", "COND");
    const body = workspace.newBlock("activity_action");
    body.setFieldValue("increment x", "TEXT");
    repeatBlock.getInput("DO")!.connection!.connect(body.previousConnection!);
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, repeatBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\nrepeat\n:increment x;\nrepeat while (x < 10)\nstop\n@enduml\n",
    );
  });

  it("generates a fork with its two default branches", () => {
    const start = workspace.newBlock("activity_start");
    const forkBlock = workspace.newBlock("activity_fork");
    const branchA = workspace.newBlock("activity_action");
    branchA.setFieldValue("branch A", "TEXT");
    forkBlock.getInput("BRANCH0")!.connection!.connect(branchA.previousConnection!);
    const branchB = workspace.newBlock("activity_action");
    branchB.setFieldValue("branch B", "TEXT");
    forkBlock.getInput("BRANCH1")!.connection!.connect(branchB.previousConnection!);
    const stop = workspace.newBlock("activity_stop");
    connectChain(start, forkBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\nfork\n:branch A;\nfork again\n:branch B;\nend fork\nstop\n@enduml\n",
    );
  });

  it("round-trips the branch-count mutator state and generates extra branches", () => {
    const start = workspace.newBlock("activity_start");
    const forkBlock = workspace.newBlock("activity_fork");
    expect(forkBlock.saveExtraState!()).toEqual({ extraBranchCount: 0 });
    expect(forkBlock.getInput("BRANCH2")).toBeNull();

    forkBlock.loadExtraState!({ extraBranchCount: 1 });
    expect(forkBlock.saveExtraState!()).toEqual({ extraBranchCount: 1 });
    expect(forkBlock.getInput("BRANCH2")).not.toBeNull();

    const branchA = workspace.newBlock("activity_action");
    branchA.setFieldValue("branch A", "TEXT");
    forkBlock.getInput("BRANCH0")!.connection!.connect(branchA.previousConnection!);
    const branchB = workspace.newBlock("activity_action");
    branchB.setFieldValue("branch B", "TEXT");
    forkBlock.getInput("BRANCH1")!.connection!.connect(branchB.previousConnection!);
    const branchC = workspace.newBlock("activity_action");
    branchC.setFieldValue("branch C", "TEXT");
    forkBlock.getInput("BRANCH2")!.connection!.connect(branchC.previousConnection!);

    const stop = workspace.newBlock("activity_stop");
    connectChain(start, forkBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n" +
        "fork\n:branch A;\nfork again\n:branch B;\nfork again\n:branch C;\n" +
        "end fork\nstop\n@enduml\n",
    );

    forkBlock.loadExtraState!({ extraBranchCount: 0 });
    expect(forkBlock.getInput("BRANCH2")).toBeNull();
  });

  it("generates nested containers (fork branch containing an if containing a while)", () => {
    const start = workspace.newBlock("activity_start");
    const forkBlock = workspace.newBlock("activity_fork");

    const ifBlock = workspace.newBlock("activity_if");
    ifBlock.setFieldValue("x > 0", "COND");
    const whileBlock = workspace.newBlock("activity_while");
    whileBlock.setFieldValue("x < 10", "COND");
    const innerAction = workspace.newBlock("activity_action");
    innerAction.setFieldValue("increment x", "TEXT");
    whileBlock.getInput("DO")!.connection!.connect(innerAction.previousConnection!);
    ifBlock.getInput("DO0")!.connection!.connect(whileBlock.previousConnection!);
    forkBlock.getInput("BRANCH0")!.connection!.connect(ifBlock.previousConnection!);

    const branchB = workspace.newBlock("activity_action");
    branchB.setFieldValue("branch B", "TEXT");
    forkBlock.getInput("BRANCH1")!.connection!.connect(branchB.previousConnection!);

    const stop = workspace.newBlock("activity_stop");
    connectChain(start, forkBlock, stop);

    expect(activityWorkspaceToCode(workspace)).toBe(
      "@startuml\nstart\n" +
        "fork\n" +
        "if (x > 0) then (yes)\nwhile (x < 10)\n:increment x;\nendwhile\nendif\n" +
        "fork again\n:branch B;\n" +
        "end fork\nstop\n@enduml\n",
    );
  });
});
