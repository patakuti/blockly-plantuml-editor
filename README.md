# Blockly PlantUML Editor

A no-code editor for PlantUML **activity diagrams** and **sequence diagrams**, built with [Blockly](https://developers.google.com/blockly). Drag blocks together and see a live PlantUML preview update as you edit — no PlantUML syntax required.

## Features

- **Activity diagrams**: Start/Stop (optional, like plain PlantUML — see below), Action, If/Then/Else, While, Repeat, Fork, Partition, Swimlane, Raw PlantUML Line — If/Then/Else has an else-branch checkbox with editable then/else labels, Fork has a mutator for variable branch counts, Partition groups a sequence of statements (nestable), Swimlane switches the current lane for subsequent statements (reorder by dragging to control lane order), Raw PlantUML Line emits its text as a single line of PlantUML verbatim (unescaped) for syntax this app has no dedicated block for.
- **PlantUML import (activity diagrams only)**: the "Import PlantUML" toolbar button opens a paste-in dialog that parses PlantUML activity-diagram source back into blocks. It only recognizes the syntax subset this app's own generator produces (see "Known limitations" below); anything else becomes a Raw PlantUML Line block instead of being dropped. A structurally broken paste (e.g. a missing `endif`) shows an error in the dialog and leaves the workspace untouched.
- **Sequence diagrams**: Participant, Message, Alt/Opt/Loop, Note — with dynamic dropdowns that track declared participants, a mutator for optional else branches on Alt, and Participant blocks that chain together so they can be reordered by dragging.
- **Notes on any block**: right-click a block and "Add Comment" to attach freeform text; it's rendered as a PlantUML `note` right after that block's own output. A "Note direction" right-click item (shown only on commented blocks) toggles the note between `right` (default) and `left`.
- **Live preview**: generated PlantUML is rendered via a PlantUML server (public by default, configurable — see below), debounced so dragging blocks doesn't spam requests. The editor/preview split is resizable by dragging the handle between them.
- **Source highlighting**: selecting a block highlights the PlantUML source text it generated, since the rendered SVG has no per-element mapping back to blocks.
- **Consistency warnings**: sequence Message/Note blocks referencing a participant that no longer exists, Alt/Opt/Loop nesting deeper than 3 levels, more than one activity-diagram Start block, and a Start block's pinned swimlane no longer existing, are flagged with a block warning icon.
- **Persistence**: each diagram's workspace autosaves to `localStorage` and restores on load. JSON (workspace state) can be saved/loaded, and PlantUML text can be exported (next to the source preview) or copied as a fenced ` ```plantuml ` block for pasting into Markdown. Save/Export use the browser's native save dialog where supported (Chrome/Edge), falling back to a plain download elsewhere (e.g. Firefox).
- **Editing tools**: Undo and Clear (with a confirmation prompt) in the toolbar; dragging, duplicating, and deleting a block all act on the same range — the block plus everything connected below it.
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
    common/      # shared statement-walking, note-wrapping, escaping/unescaping helpers
    activityGenerator.ts
    sequenceGenerator.ts
  import/        # PlantUML activity-diagram text -> blocks: parser + workspace builder
  preview/       # PlantUML server URL + hex-encoding, and the preview/source panel
  workspace/     # per-diagram Blockly workspace lifecycle, localStorage/JSON/file persistence
  ui/            # tab bar, toolbar (Save/Load JSON, Undo, Clear, server setting, Import PlantUML), splitter, import dialog
  types/         # ambient type declarations (File System Access API)
  main.ts        # wires everything together
tests/
  generators/    # unit tests for the code generators, run against headless Blockly workspaces
  import/        # unit tests for the PlantUML import parser and a parse-build-regenerate round trip
```

## Testing

Unit tests cover the block-to-PlantUML code generators (single blocks, nested containers, mutator state round-trips, text escaping, and the activity/sequence-diagram consistency checks) using headless `Blockly.Workspace` instances — no browser required. The same approach covers the PlantUML import parser (each recognized construct, nesting, error cases) and a round trip (generate → parse → rebuild → regenerate) that checks the two directions agree. UI behavior and PlantUML rendering are verified manually/interactively rather than through automated E2E tests.

```sh
npm test
```

## Notes on PlantUML text escaping

Free-form text (Action/Message/Note bodies, participant names) is escaped only where verified necessary against the live PlantUML server:

- A literal `@` is replaced with the HTML entity `&#64;`, since `@enduml` (or any `@...` directive) appearing anywhere in a line terminates the diagram early.
- A `"` inside a participant/message-endpoint name is replaced with `'`, since PlantUML doesn't support escaping quotes inside a quoted identifier.
- Semicolons, colons, and raw newlines were confirmed to render correctly unescaped and are left as-is.

## Notes on swimlane ordering

PlantUML rejects a `|Name|` swimlane marker that appears after `start` (verified against the public server). `activityWorkspaceToCode()` automatically hoists each distinct lane name's first occurrence to the very front of the generated body (ahead of `start`, if present); the real markers stay in place as harmless re-declarations. Column order follows the order lanes first appear in the generated text, so dragging Swimlane blocks to reorder them (or placing empty ones up front) controls the lane display order.

Which lane `start` itself is drawn in is determined by whichever `|Name|` declaration comes immediately before it (also verified against the public server) — which, without help, is just whichever lane happens to sort last among the hoisted declarations above. The Start block has an "in" dropdown (populated from the Swimlane blocks in the workspace, defaulting to "(auto)") to pin it explicitly: when set, that lane's declaration is moved to the end of the hoisted list so `start` reliably lands there, even if that lane is otherwise unused (PlantUML just draws it as an empty column). If the pinned lane's name stops matching any Swimlane block (renamed or deleted), the Start block gets a warning icon.

## Known limitations

- Activity diagram Start/Stop are plain, optional blocks (PlantUML itself doesn't require them either): Start allows at most one (a second one triggers a warning icon on both, though the diagram still generates), and Stop allows any number, including zero. New activity workspaces start empty rather than pre-populated with a Start/Stop pair.
- If the activity workspace has more than one disconnected block chain, only one is rendered: the chain containing the Start block if one exists, otherwise the top-most/left-most chain by position. The other chains are silently excluded from the generated PlantUML — there's no warning for this case, since a stray chain may just be a work-in-progress fragment.
- Sequence diagram participants declare in the order they're chained together (reorder by dragging); a participant left disconnected from that chain still appears, ordered by its Y-position in the workspace.
- The message/statement chain generator only follows a single chain from its anchor block; additional disconnected chains elsewhere in the workspace are not included in the generated output.
- PlantUML import only supports activity diagrams (see above); sequence diagrams have no importer.
- The import parser only recognizes the syntax subset this app's own generator produces, not PlantUML's full grammar. Conditions/labels containing literal `)` or `{` may not parse correctly, since the parser locates them with the first matching delimiter (the same free-text limitation the escaping already accepts). Everything else unrecognized becomes a Raw PlantUML Line block rather than being interpreted or dropped.
- Import doesn't reconstruct a Start block's pinned swimlane (the "in" dropdown) — an imported Start always comes back as "(auto)", since the pin can't be distinguished from PlantUML's own required lane hoisting once generated.
