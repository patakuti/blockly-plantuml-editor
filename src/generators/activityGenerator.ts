import * as Blockly from "blockly/core";
import { generateStatements } from "./common/statementGenerator";
import { escapeText } from "./common/escape";

export const activityGenerator = new Blockly.CodeGenerator("PlantUMLActivity");

activityGenerator.forBlock["activity_start"] = () => "start\n";
activityGenerator.forBlock["activity_stop"] = () => "stop\n";
activityGenerator.forBlock["activity_action"] = (block) => {
  const text = escapeText(block.getFieldValue("TEXT"));
  return `:${text};\n`;
};
activityGenerator.forBlock["activity_if"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const thenLabel = escapeText(block.getFieldValue("THEN_LABEL"));
  const thenBody = generateStatements(generator, block.getInputTargetBlock("DO0"));
  let code = `if (${cond}) then (${thenLabel})\n${thenBody}`;
  if (block.getInput("ELSE")) {
    const elseLabel = escapeText(block.getFieldValue("ELSE_LABEL"));
    const elseBody = generateStatements(generator, block.getInputTargetBlock("ELSE"));
    code += `else (${elseLabel})\n${elseBody}`;
  }
  code += "endif\n";
  return code;
};
activityGenerator.forBlock["activity_while"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `while (${cond})\n${body}endwhile\n`;
};
activityGenerator.forBlock["activity_repeat"] = (block, generator) => {
  const cond = escapeText(block.getFieldValue("COND"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `repeat\n${body}repeat while (${cond})\n`;
};
activityGenerator.forBlock["activity_fork"] = (block, generator) => {
  const branches: string[] = [];
  for (let i = 0; block.getInput(`BRANCH${i}`); i++) {
    branches.push(generateStatements(generator, block.getInputTargetBlock(`BRANCH${i}`)));
  }
  return `fork\n${branches.join("fork again\n")}end fork\n`;
};
activityGenerator.forBlock["activity_partition"] = (block, generator) => {
  const name = escapeText(block.getFieldValue("NAME"));
  const body = generateStatements(generator, block.getInputTargetBlock("DO"));
  return `partition ${name} {\n${body}}\n`;
};
activityGenerator.forBlock["activity_swimlane"] = (block) => {
  const name = escapeText(block.getFieldValue("NAME"));
  return `|${name}|\n`;
};

/**
 * Generates full PlantUML source for the activity-diagram workspace.
 * start/stop are optional (FR-ACT-01), so the workspace can contain several
 * disconnected top-level chains. Exactly one is picked as the output chain
 * (02_design.md 14.2): prefer the chain headed by an `activity_start` block
 * (position order breaks ties if more than one exists -- see
 * validateActivityWorkspace for the accompanying warning); otherwise fall
 * back to the first top block in position order, whatever its type. Other
 * chains are dropped entirely, not just their unreachable tail.
 */
export function activityWorkspaceToCode(workspace: Blockly.Workspace): string {
  const topBlocks = workspace.getTopBlocks(true);
  const headBlock = topBlocks.find((block) => block.type === "activity_start") ?? topBlocks[0] ?? null;
  const body = generateStatements(activityGenerator, headBlock);
  const pinnedLane =
    headBlock?.type === "activity_start" ? ((headBlock.getFieldValue("SWIMLANE") as string) || null) : null;
  return `@startuml\n${hoistSwimlaneDeclarations(body, pinnedLane)}${body}@enduml\n`;
}

/**
 * PlantUML requires every swimlane (`|Name|`) to be declared before the
 * diagram's first node -- verified against the public PlantUML server
 * (2026-07-21): any `|Name|` appearing after `start` fails with "This
 * swimlane must be defined at the start of the diagram", even when it's the
 * very first statement right after `start`. This hoist runs unconditionally
 * on the generated body regardless of whether the output chain happens to
 * start with `activity_start` (FR-ACT-01 made start optional), so it also
 * covers a chain that opens directly with an `activity_swimlane` block.
 *
 * Re-declaring an already-declared lane elsewhere in the diagram is fine
 * (verified), so the fix is to scan the already-generated body for each
 * distinct lane name's first occurrence (in that order -- which is also what
 * determines left-to-right column order, also verified) and emit one bare
 * `|Name|` per distinct lane before the body.
 *
 * Which lane `start` itself lands in is determined by whichever `|Name|`
 * declaration comes immediately before it (verified against the public
 * PlantUML server, 2026-07-21) -- so without `pinnedLane`, that's whatever
 * lane happens to sort last among the hoisted declarations, which is
 * essentially arbitrary from the user's point of view. When `pinnedLane` is
 * given (the activity_start block's SWIMLANE field, 02_design.md 14.5), one
 * more bare `|pinnedLane|` line is appended right after the regular hoisted
 * block (even if that lane never otherwise appears in the body, which
 * PlantUML renders as a harmless empty lane -- also verified) so `start`
 * reliably ends up there. This is a *re-declaration*, not a move: the
 * pinned lane's position in the initial hoisted block -- which is what
 * determines its left-to-right column order -- is left untouched, since
 * re-ordering it instead would silently change the diagram's lane order as
 * a side effect of pinning `start` (verified this distinction against the
 * public server too).
 */
function hoistSwimlaneDeclarations(body: string, pinnedLane: string | null): string {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(/^\|([^|\n]+)\|$/gm)) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);
    order.push(name);
  }
  let declarations = order.map((name) => `|${name}|\n`).join("");
  if (pinnedLane) declarations += `|${pinnedLane}|\n`;
  return declarations;
}
