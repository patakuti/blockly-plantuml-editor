import * as Blockly from "blockly/core";
import { SEQUENCE_STATEMENT } from "./constants";

/**
 * Scans the workspace for declared participants (see 02_design.md 5.2.1:
 * declaration order is inferred from Y position, not a connection chain)
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
      colour: 160,
      tooltip: "Declares a participant (lifeline).",
    },
  ]);

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
}
