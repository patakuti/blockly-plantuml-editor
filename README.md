# Blockly PlantUML Editor

A no-code editor for PlantUML **activity diagrams** and **sequence diagrams**, built with [Blockly](https://developers.google.com/blockly). Drag blocks together and see a live PlantUML preview update as you edit — no PlantUML syntax required.

## Features

- **Activity diagrams**: Start/Stop (fixed), Action, If/Then/Else, While, Repeat, Fork — If/Then/Else has an else-branch checkbox with editable then/else labels, Fork has a mutator for variable branch counts.
- **Sequence diagrams**: Participant, Message, Alt/Opt/Loop, Note — with dynamic dropdowns that track declared participants and a mutator for optional else branches on Alt.
- **Live preview**: generated PlantUML is rendered via the public PlantUML server (`https://www.plantuml.com/plantuml/svg/~h...`), debounced so dragging blocks doesn't spam requests.
- **Source highlighting**: selecting a block highlights the PlantUML source text it generated, since the rendered SVG has no per-element mapping back to blocks.
- **Consistency warnings**: sequence Message/Note blocks referencing a participant that no longer exists, and Alt/Opt/Loop nesting deeper than 3 levels, are flagged with a block warning icon.
- **Persistence**: each diagram's workspace autosaves to `localStorage` and restores on load. JSON (workspace state) and PlantUML text can be exported/imported per diagram.

Each diagram type has its own independent Blockly workspace; switching tabs never loses in-progress edits in the other diagram.

## Getting started

```sh
npm install
npm run dev
```

Then open the printed local URL in a browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check (`tsc -b`) and produce a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the unit test suite (Vitest). |

## Project structure

```
src/
  blocks/
    activity/    # activity_* block definitions, mutators, toolbox
    sequence/    # sequence_* block definitions, mutators, toolbox, validation
  generators/
    common/      # shared statement-walking, note-wrapping, escaping helpers
    activityGenerator.ts
    sequenceGenerator.ts
  preview/       # PlantUML hex-encoding and the preview/source panel
  workspace/     # per-diagram Blockly workspace lifecycle, localStorage/JSON persistence
  ui/            # tab bar and toolbar (Save/Load JSON, Export PlantUML)
  main.ts        # wires everything together
tests/
  generators/    # unit tests for the code generators, run against headless Blockly workspaces
```

## Testing

Unit tests cover the block-to-PlantUML code generators (single blocks, nested containers, mutator state round-trips, text escaping, and the sequence-diagram consistency checks) using headless `Blockly.Workspace` instances — no browser required. UI behavior and PlantUML rendering are verified manually/interactively rather than through automated E2E tests.

```sh
npm test
```

## Notes on PlantUML text escaping

Free-form text (Action/Message/Note bodies, participant names) is escaped only where verified necessary against the live PlantUML server:

- A literal `@` is replaced with the HTML entity `&#64;`, since `@enduml` (or any `@...` directive) appearing anywhere in a line terminates the diagram early.
- A `"` inside a participant/message-endpoint name is replaced with `'`, since PlantUML doesn't support escaping quotes inside a quoted identifier.
- Semicolons, colons, and raw newlines were confirmed to render correctly unescaped and are left as-is.

## Known limitations

- The activity diagram's Start/Stop blocks are non-deletable and never offered in the toolbox, which prevents the usual ways of ending up without a Stop or with multiple Starts. Start is also non-movable; Stop deliberately is **not** (Blockly refuses to let you drag a block into a stack position immediately before an immovable, non-shadow block, which made it impossible to insert anything right before an immovable Stop). Dragging Stop itself away from the chain is still structurally possible; this is accepted as a known edge case rather than solved with custom drag-handling.
- Sequence diagram participant declaration order is inferred from block Y-position in the workspace, not from an explicit ordering mechanism.
- The message/statement chain generator only follows a single chain from its anchor block; additional disconnected chains elsewhere in the workspace are not included in the generated output.
