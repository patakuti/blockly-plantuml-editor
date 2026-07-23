import * as Blockly from "blockly/core";
import { COMPONENT_STATEMENT } from "./constants";

/**
 * Scans the workspace for declared components (component_component, at any
 * nesting depth) and returns them as dropdown options for Dependency's
 * "from"/"to" fields (02_design.md 27.3). getBlocksByType already returns
 * blocks regardless of nesting depth (confirmed via state/blocks.ts's
 * stateOptions finding state_state nested inside state_composite), so no
 * extra recursion is needed here even though components can nest.
 */
function componentOptions(this: Blockly.FieldDropdown): Blockly.MenuOption[] {
  const block = this.getSourceBlock();
  const names = block
    ? block.workspace.getBlocksByType("component_component", true).map((b) => b.getFieldValue("NAME") as string)
    : [];
  if (names.length === 0) return [["(no components)", ""]];
  return names.map((name) => [name, name]);
}

/**
 * Accepts any string value, not just the field's current options list. Same
 * rationale as sequence/blocks.ts's ParticipantDropdownField and
 * state/blocks.ts's StateDropdownField: without this, a component referenced
 * by a Dependency before it's declared (or one that gets renamed/deleted
 * later) would have its FROM/TO value silently rejected or wiped on restore.
 * Referencing a name that no longer exists is instead surfaced as a block
 * warning (FR-COMP-05).
 */
class ComponentDropdownField extends Blockly.FieldDropdown {
  protected override doClassValidation_(newValue: string): string | null | undefined;
  protected override doClassValidation_(newValue?: string): string | null;
  protected override doClassValidation_(newValue?: string): string | null | undefined {
    return newValue ?? null;
  }
}

export function defineComponentBlocks(): void {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "component_component",
      message0: "component %1",
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "Component1",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
          check: COMPONENT_STATEMENT,
        },
      ],
      previousStatement: COMPONENT_STATEMENT,
      nextStatement: COMPONENT_STATEMENT,
      colour: 160,
      tooltip: "Declares a component. Can nest (a component inside another component's body).",
    },
    {
      type: "component_raw_line",
      message0: "raw %1",
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "'",
        },
      ],
      previousStatement: COMPONENT_STATEMENT,
      nextStatement: COMPONENT_STATEMENT,
      colour: 330,
      tooltip:
        "Emits its text as a single line of PlantUML, verbatim and unescaped. " +
        "Use it for syntax this app doesn't have a block for (e.g. interfaces, packages).",
    },
  ]);

  Blockly.Blocks["component_dependency"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(new ComponentDropdownField(componentOptions), "FROM")
        .appendField("-->")
        .appendField(new ComponentDropdownField(componentOptions), "TO")
        .appendField(":")
        .appendField(new Blockly.FieldTextInput(""), "TEXT");
      this.setPreviousStatement(true, COMPONENT_STATEMENT);
      this.setNextStatement(true, COMPONENT_STATEMENT);
      this.setColour(210);
      this.setTooltip("A dependency between two components. Label is optional.");
    },
  };
}
