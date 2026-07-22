import * as Blockly from "blockly/core";
import { SEQUENCE_STATEMENT, PARTICIPANT_STATEMENT } from "./constants";
import { defineSequenceAltMutator } from "./altMutator";
import { setFieldValueRefreshingDropdown } from "../common/setDropdownFieldValue";

/**
 * Scans the workspace for declared participants (see 02_design.md 12.11:
 * declaration order follows the participant chain, reorderable by dragging)
 * and returns them as dropdown options for Message/Note "from"/"to" fields.
 */
function participantOptions(this: Blockly.FieldDropdown): Blockly.MenuOption[] {
  const block = this.getSourceBlock();
  const names = block
    ? block.workspace
        .getBlocksByType("sequence_participant", true)
        .map((b) => b.getFieldValue("NAME") as string)
    : [];
  if (names.length === 0) return [["(no participants)", ""]];
  return names.map((name) => [name, name]);
}

/**
 * FieldDropdown normally rejects any value not present in the *current*
 * options list. That breaks here in two ways verified directly (not
 * assumed): (1) the field's very first options computation runs during
 * construction, before it's attached to a block, so getSourceBlock() is
 * still null and "(no participants)" gets cached as the only valid option;
 * (2) even after fixing that, restoring a saved workspace where a message
 * block happens to have been created (and thus serialized) before the
 * participants it references hits the same rejection, silently wiping the
 * saved FROM/TO values. Overriding validation to accept any string sidesteps
 * both, and also matches FR-SEQ-07: a message may reference a participant
 * that doesn't currently exist, and that gets surfaced as a warning
 * elsewhere rather than having Blockly silently discard the reference.
 */
class ParticipantDropdownField extends Blockly.FieldDropdown {
  protected override doClassValidation_(newValue: string): string | null | undefined;
  protected override doClassValidation_(newValue?: string): string | null;
  protected override doClassValidation_(newValue?: string): string | null | undefined {
    return newValue ?? null;
  }
}

export function defineSequenceBlocks(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "sequence_participant",
      message0: "participant %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "Participant",
        },
      ],
      previousStatement: PARTICIPANT_STATEMENT,
      nextStatement: PARTICIPANT_STATEMENT,
      colour: 160,
      tooltip: "Declares a participant (lifeline). Drag to reorder among other participants.",
    },
    {
      type: "sequence_alt",
      message0: "alt ( %1 )",
      args0: [
        {
          type: "field_input",
          name: "COND",
          text: "condition",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO0",
          check: SEQUENCE_STATEMENT,
        },
      ],
      previousStatement: SEQUENCE_STATEMENT,
      nextStatement: SEQUENCE_STATEMENT,
      colour: 210,
      tooltip: "Branch based on a condition. Use the gear icon to add/remove else branches.",
      mutator: "sequence_alt_mutator",
    },
    {
      type: "sequence_opt",
      message0: "opt ( %1 )",
      args0: [
        {
          type: "field_input",
          name: "COND",
          text: "condition",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: SEQUENCE_STATEMENT,
        },
      ],
      previousStatement: SEQUENCE_STATEMENT,
      nextStatement: SEQUENCE_STATEMENT,
      colour: 210,
      tooltip: "An optional block, executed only if the condition holds.",
    },
    {
      type: "sequence_loop",
      message0: "loop ( %1 )",
      args0: [
        {
          type: "field_input",
          name: "COND",
          text: "condition",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: SEQUENCE_STATEMENT,
        },
      ],
      previousStatement: SEQUENCE_STATEMENT,
      nextStatement: SEQUENCE_STATEMENT,
      colour: 210,
      tooltip: "Repeats its contents while the condition holds.",
    },
    {
      type: "sequence_raw_line",
      message0: "raw %1",
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "'",
        },
      ],
      previousStatement: SEQUENCE_STATEMENT,
      nextStatement: SEQUENCE_STATEMENT,
      colour: 330,
      tooltip:
        "Emits its text as a single line of PlantUML, verbatim and unescaped. " +
        "Use it for syntax this app doesn't have a block for, or as a placeholder for lines an import couldn't recognize.",
    },
  ]);

  defineSequenceAltMutator();

  Blockly.Blocks["sequence_message"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(new ParticipantDropdownField(participantOptions), "FROM")
        .appendField("->")
        .appendField(new ParticipantDropdownField(participantOptions), "TO")
        .appendField(":")
        .appendField(new Blockly.FieldTextInput("message"), "TEXT");
      this.setPreviousStatement(true, SEQUENCE_STATEMENT);
      this.setNextStatement(true, SEQUENCE_STATEMENT);
      this.setColour(210);
      this.setTooltip("Sends a message from one participant to another.");
    },
  };

  Blockly.Blocks["sequence_note"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("note")
        .appendField(
          new Blockly.FieldDropdown([
            ["left of", "left"],
            ["right of", "right"],
          ]),
          "SIDE",
        )
        .appendField(new ParticipantDropdownField(participantOptions), "TARGET")
        .appendField(":")
        .appendField(new Blockly.FieldTextInput("note"), "TEXT");
      this.setPreviousStatement(true, SEQUENCE_STATEMENT);
      this.setNextStatement(true, SEQUENCE_STATEMENT);
      this.setColour(160);
      this.setTooltip("Attaches a note to a participant's lifeline.");

      // Default TARGET to the first declared participant so a freshly dropped
      // note renders immediately instead of sitting on an empty selection
      // (FR-SEQ-10). A saved workspace's actual TARGET value, if any, is
      // applied by the deserializer right after this and overrides it; a
      // flyout preview instance sees no participants in its own workspace and
      // is left untouched. Goes through setFieldValueRefreshingDropdown
      // (common/setDropdownFieldValue.ts) rather than a plain setFieldValue:
      // TARGET's options were cached as "(no participants)" when this field
      // was constructed (before any participant existed to find), so without
      // the refresh the block's on-screen label would keep showing that even
      // though the value/generated PlantUML are already correct.
      const names = this.workspace
        .getBlocksByType("sequence_participant", true)
        .map((b) => b.getFieldValue("NAME") as string);
      if (names.length > 0) setFieldValueRefreshingDropdown(this, "TARGET", names[0]);
    },
  };
}
