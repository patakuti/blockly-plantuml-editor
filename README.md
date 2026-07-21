# Blockly PlantUML Editor

A no-code editor for PlantUML **activity diagrams** and **sequence diagrams**, built with [Blockly](https://developers.google.com/blockly). Drag blocks together and see a live PlantUML preview update as you edit — no PlantUML syntax required.

## Features

- **Activity diagrams**: Start/Stop (fixed), Action, If/Then/Else, While, Repeat, Fork, Partition, Swimlane — If/Then/Else has an else-branch checkbox with editable then/else labels, Fork has a mutator for variable branch counts, Partition groups a sequence of statements (nestable), Swimlane switches the current lane for subsequent statements (reorder by dragging to control lane order).
- **Sequence diagrams**: Participant, Message, Alt/Opt/Loop, Note — with dynamic dropdowns that track declared participants, a mutator for optional else branches on Alt, and Participant blocks that chain together so they can be reordered by dragging.
- **Notes on any block**: right-click a block and "Add Comment" to attach freeform text; it's rendered as a PlantUML `note` right after that block's own output. A "Note direction" right-click item (shown only on commented blocks) toggles the note between `right` (default) and `left`.
- **Live preview**: generated PlantUML is rendered via a PlantUML server (public by default, configurable — see below), debounced so dragging blocks doesn't spam requests. The editor/preview split is resizable by dragging the handle between them.
- **Source highlighting**: selecting a block highlights the PlantUML source text it generated, since the rendered SVG has no per-element mapping back to blocks.
- **Consistency warnings**: sequence Message/Note blocks referencing a participant that no longer exists, and Alt/Opt/Loop nesting deeper than 3 levels, are flagged with a block warning icon.
- **Persistence**: each diagram's workspace autosaves to `localStorage` and restores on load. JSON (workspace state) can be saved/loaded, and PlantUML text can be exported (next to the source preview) or copied as a fenced ` ```plantuml ` block for pasting into Markdown. Save/Export use the browser's native save dialog where supported (Chrome/Edge), falling back to a plain download elsewhere (e.g. Firefox).
- **Editing tools**: Undo and Clear (with a confirmation prompt) in the toolbar; dragging, duplicating, and deleting a block all act on the same range — the block plus everything connected below it — except a non-deletable block (Stop) is never swept into a duplicate or delete.
- **Configurable PlantUML server**: the "PlantUML Server" toolbar button lets you point the preview at any PlantUML-compatible server instead of the public default.

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
    activity/    # activity_* block definitions, mutators/toggles, toolbox
    sequence/    # sequence_* block definitions, mutators, toolbox, validation
    common/      # cross-diagram block behavior (unified drag/duplicate/delete range, note direction menu)
  generators/
    common/      # shared statement-walking, note-wrapping, escaping helpers
    activityGenerator.ts
    sequenceGenerator.ts
  preview/       # PlantUML server URL + hex-encoding, and the preview/source panel
  workspace/     # per-diagram Blockly workspace lifecycle, localStorage/JSON/file persistence
  ui/            # tab bar, toolbar (Save/Load JSON, Undo, Clear, server setting), splitter
  types/         # ambient type declarations (File System Access API)
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

## Notes on swimlane ordering

PlantUML rejects a `|Name|` swimlane marker that appears after `start` (verified against the public server). Since the activity diagram's Start block is always fixed first, `activityWorkspaceToCode()` automatically hoists each distinct lane name's first occurrence to right before `start`; the real markers stay in place as harmless re-declarations. Column order follows the order lanes first appear in the generated text, so dragging Swimlane blocks to reorder them (or placing empty ones up front) controls the lane display order.

## Known limitations

- The activity diagram's Start/Stop blocks are non-deletable and never offered in the toolbox, which prevents the usual ways of ending up without a Stop or with multiple Starts. Start is also non-movable; Stop deliberately is **not** (Blockly refuses to let you drag a block into a stack position immediately before an immovable, non-shadow block, which made it impossible to insert anything right before an immovable Stop). Dragging Stop itself away from the chain is still structurally possible; this is accepted as a known edge case rather than solved with custom drag-handling.
- Sequence diagram participants declare in the order they're chained together (reorder by dragging); a participant left disconnected from that chain still appears, ordered by its Y-position in the workspace.
- The message/statement chain generator only follows a single chain from its anchor block; additional disconnected chains elsewhere in the workspace are not included in the generated output.
