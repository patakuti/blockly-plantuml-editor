import * as Blockly from "blockly/core";
import { STATE_STATEMENT } from "./constants";

/**
 * state_composite always has one mandatory region (the DO input, defined
 * statically in the block's JSON). The mutator adds/removes further
 * concurrent regions (REGION1, REGION2, ...), each preceded by a "--"/"||"
 * separator (FR-STATE-17), following the same pattern as
 * activity/forkMutator.ts (which has two mandatory branches instead of one).
 */
interface StateCompositeBlock extends Blockly.Block {
  extraRegionCount_: number;
}

/**
 * Region-separator symbols (FR-STATE-17): "--" (horizontal) or "||"
 * (vertical). Confirmed against the official PlantUML server that only the
 * *first* separator in a Composite State's body decides the whole state's
 * layout axis -- rendering two test diagrams and comparing the resulting
 * SVG coordinates showed every region stacked according to the first
 * separator alone, regardless of what any later separator said (02_design.md
 * 39.1a). So a single shared choice is exposed as an interactive dropdown on
 * the first boundary (REGION_SEP_1's "SEPARATOR" field); every later
 * boundary mirrors it as a plain, non-interactive label kept in sync by
 * `separatorValidator` so the block never displays a choice that would be
 * silently ignored by PlantUML.
 */
const SEPARATOR_OPTIONS: [string, string][] = [
  ["--", "--"],
  ["||", "||"],
];
const DEFAULT_SEPARATOR = "--";

/** Current effective separator (the first boundary's field value, or the default if there is no boundary yet). */
function currentSeparator(block: StateCompositeBlock): string {
  const field = block.getField("SEPARATOR");
  return field ? (field.getValue() as string) : DEFAULT_SEPARATOR;
}

/** Mirrors a change to the first boundary's dropdown onto every later boundary's read-only label. */
function separatorValidator(this: Blockly.FieldDropdown, newValue: string): string {
  const block = this.getSourceBlock() as StateCompositeBlock | null;
  if (block) {
    let i = 2;
    while (block.getInput(`REGION_SEP_${i}`)) {
      (block.getField(`SEPARATOR_LABEL${i}`) as Blockly.FieldLabel | null)?.setValue(newValue);
      i++;
    }
  }
  return newValue;
}

/**
 * Remove all region inputs (index >= 1), then re-add the current count. The
 * shared separator choice is preserved across a mutator-triggered rebuild
 * (compose()/loadExtraState()) by reading it out before removal and
 * restoring it on the recreated fields -- rebuildShape fully tears down and
 * recreates every separator input regardless of whether the count actually
 * changed, so without this a region count change would silently reset the
 * choice back to "--".
 */
function rebuildShape(block: StateCompositeBlock): void {
  const separator = currentSeparator(block);
  let i = 1;
  while (block.getInput(`REGION_SEP_${i}`)) {
    block.removeInput(`REGION_SEP_${i}`);
    block.removeInput(`REGION${i}`);
    i++;
  }
  for (let j = 0; j < block.extraRegionCount_; j++) {
    const index = 1 + j;
    const sepInput = block.appendDummyInput(`REGION_SEP_${index}`);
    if (index === 1) {
      sepInput.appendField(new Blockly.FieldDropdown(SEPARATOR_OPTIONS, separatorValidator), "SEPARATOR");
      block.setFieldValue(separator, "SEPARATOR");
    } else {
      sepInput.appendField(new Blockly.FieldLabel(separator), `SEPARATOR_LABEL${index}`);
    }
    block.appendStatementInput(`REGION${index}`).setCheck(STATE_STATEMENT);
  }
}

const stateRegionMutatorMixin = {
  extraRegionCount_: 0,

  saveExtraState(this: StateCompositeBlock): { extraRegionCount: number } {
    return { extraRegionCount: this.extraRegionCount_ };
  },

  loadExtraState(this: StateCompositeBlock, state: { extraRegionCount?: number }): void {
    this.extraRegionCount_ = state.extraRegionCount ?? 0;
    rebuildShape(this);
  },

  decompose(this: StateCompositeBlock, workspace: Blockly.Workspace): Blockly.Block {
    const containerBlock = workspace.newBlock("state_region_mutator_container") as Blockly.BlockSvg;
    containerBlock.initSvg();
    containerBlock.render();

    let connection = containerBlock.getInput("STACK")!.connection!;
    for (let i = 0; i < this.extraRegionCount_; i++) {
      const itemBlock = workspace.newBlock("state_region_mutator_region") as Blockly.BlockSvg;
      itemBlock.initSvg();
      itemBlock.render();
      connection.connect(itemBlock.previousConnection!);
      connection = itemBlock.nextConnection!;
    }
    return containerBlock;
  },

  compose(this: StateCompositeBlock, containerBlock: Blockly.Block): void {
    let count = 0;
    let itemBlock = containerBlock.getInputTargetBlock("STACK");
    while (itemBlock) {
      count++;
      itemBlock = itemBlock.getNextBlock();
    }
    this.extraRegionCount_ = count;
    rebuildShape(this);
  },
};

export function defineStateRegionMutator(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "state_region_mutator_container",
      message0: "regions %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "STACK" },
      ],
      colour: 290,
      tooltip: "Drag in \"region\" blocks to add more concurrent regions.",
    },
    {
      type: "state_region_mutator_region",
      message0: "region",
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
  ]);

  if (!Blockly.Extensions.isRegistered("state_region_mutator")) {
    Blockly.Extensions.registerMutator(
      "state_region_mutator",
      stateRegionMutatorMixin,
      undefined,
      ["state_region_mutator_region"],
    );
  }
}
