# Blockly PlantUML Editor

A no-code editor for PlantUML **activity diagrams**, **sequence diagrams**, and **state diagrams**, built with [Blockly](https://developers.google.com/blockly). Drag blocks together and see a live PlantUML preview update as you edit — no PlantUML syntax required.

## Features

- **Activity diagrams**: Start/Stop (optional, like plain PlantUML — see below), Action, If/Then/Else, While, Repeat, Fork, Partition, Swimlane, Raw PlantUML Line — If/Then/Else has an else-branch checkbox with editable then/else labels, Fork has a mutator for variable branch counts, Partition groups a sequence of statements (nestable), Swimlane switches the current lane for subsequent statements (reorder by dragging to control lane order), Raw PlantUML Line emits its text as a single line of PlantUML verbatim (unescaped) for syntax this app has no dedicated block for. Renaming a Swimlane block prompts to apply the rename to just that block or to every other Swimlane block still sharing the old name (also updating a Start block pinned to that lane), but only when such other blocks actually exist.
- **PlantUML import (all three diagram types)**: the "Import PlantUML" toolbar button opens a paste-in dialog (per diagram type) that parses PlantUML source back into blocks. It only recognizes the syntax subset that diagram type's own generator produces (see "Known limitations" below); anything else becomes a Raw PlantUML Line block instead of being dropped. A structurally broken paste (e.g. a missing `endif`/`end`/`}`) shows an error in the dialog and leaves the workspace untouched. A pasted-in ` ```plantuml ` Markdown code fence (e.g. from "Copy as Markdown") is recognized and stripped automatically.
- **Sequence diagrams**: Participant, Message, Alt/Opt/Loop, Note, Raw PlantUML Line — with dynamic dropdowns that track declared participants, a mutator for optional else branches on Alt, and Participant blocks that chain together so they can be reordered by dragging. Renaming a Participant block automatically updates every Message/Note field that referenced its old name.
- **State diagrams**: State, Choice, Transition, Composite State, Raw PlantUML Line — Transition's from/to fields are dynamic dropdowns listing every declared State/Composite State/Choice plus `[*]` (the start/end pseudostate); its label is optional. Composite State groups a sequence of states/transitions under a nested `state Name { ... }` block and can nest arbitrarily deep, and has a mutator (gear icon) for adding concurrent regions separated by `--`. Choice declares a `<<choice>>` branch pseudostate, connected to/from other states just like a regular State. Renaming a State, Composite State, or Choice block automatically updates every Transition field that referenced its old name. History pseudostates and fork/join pseudostate bars aren't supported (use Raw PlantUML Line for those).
- **Notes on any block**: right-click a block and "Add Comment" to attach freeform text; it's rendered as a PlantUML `note` right after that block's own output. A "Note direction" right-click item (shown only on commented blocks) toggles the note between `right` (default) and `left`. On state diagrams, only State, Composite State, and Choice blocks support notes (rendered as `note X of <name>`, explicitly anchored to that block's own name) — Transition has no "Add Comment" option, since PlantUML has no reliable way to attach a note to a transition.
- **Live preview**: generated PlantUML is rendered via a PlantUML server (public by default, configurable — see below), debounced so dragging blocks doesn't spam requests. The editor/preview split is resizable by dragging the handle between them.
- **Source highlighting**: selecting a block highlights the PlantUML source text it generated, since the rendered SVG has no per-element mapping back to blocks.
- **Consistency warnings**: sequence Message/Note blocks referencing a participant that no longer exists, Alt/Opt/Loop nesting deeper than 3 levels, more than one activity-diagram Start block, a Start block's pinned swimlane no longer existing, and a state-diagram Transition's from/to referencing a State/Composite State/Choice that no longer exists, are flagged with a block warning icon.
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
    state/       # state_* block definitions, toolbox, validation, comment restriction
    common/      # cross-diagram block behavior (unified drag/duplicate/delete range, note direction menu)
  generators/
    common/      # shared statement-walking, note-wrapping, escaping/unescaping helpers
    activityGenerator.ts
    sequenceGenerator.ts
  import/        # PlantUML text -> blocks: per-diagram-type (activity/sequence/state) parser + workspace builder, plus shared line-cursor/preprocessing helpers
  preview/       # PlantUML server URL + hex-encoding, and the preview/source panel
  workspace/     # per-diagram Blockly workspace lifecycle, localStorage/JSON/file persistence
  ui/            # tab bar, toolbar (Save/Load JSON, Undo, Clear, server setting, Import PlantUML), splitter, import dialog
  types/         # ambient type declarations (File System Access API)
  main.ts        # wires everything together
tests/
  generators/    # unit tests for the code generators, run against headless Blockly workspaces
  import/        # unit tests for all three diagram types' PlantUML import parsers and their parse-build-regenerate round trips
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
- The activity/sequence statement chain generator only follows a single chain from its anchor block; additional disconnected chains elsewhere in the workspace are not included in the generated output. State diagrams are the exception: every top-level chain is included (there's no single "main flow" concept for a graph-shaped diagram), so nothing gets silently dropped there.
- State/Composite State/Choice names must be simple identifiers with no spaces or `"` — PlantUML's state-diagram parser was confirmed (against the public server) to misparse the diagram type entirely, or reject the syntax outright, when a Transition's endpoints are quoted or contain a space. Input isn't validated or sanitized to enforce this; using such a name will just produce a broken PlantUML render.
- Notes are only supported on State, Composite State, and Choice blocks; Transition has no "Add Comment" menu item, since PlantUML has no reliable syntax for attaching a note to a transition (verified against the public server: the implicit `note right`/`note left` form can fail to render depending on what precedes it).
- History pseudostates (`[H]`/`[H*]`), fork/join pseudostate bars (`<<fork>>`/`<<join>>`), and the `||` concurrent-region separator (an alternative to `--`, which this app never generates) aren't supported by a dedicated block; use Raw PlantUML Line to write that syntax directly. On import, a `||` line inside a Composite State's body is kept as a Raw PlantUML Line within whichever region it appeared in, rather than starting a new region.
- Each diagram type's import parser only recognizes the syntax subset that diagram type's own generator produces, not PlantUML's full grammar. Conditions/labels containing literal `)` or `{` may not parse correctly, since the parser locates them with the first matching delimiter (the same free-text limitation the escaping already accepts). Everything else unrecognized becomes a Raw PlantUML Line block rather than being interpreted or dropped. Pasting into the wrong diagram type's dialog (e.g. sequence-diagram source into the Activity tab's importer) parses as entirely unrecognized text — every line becomes a Raw PlantUML Line block, which still regenerates byte-identical PlantUML (and so still previews correctly), even though none of it became real blocks.
- Import doesn't reconstruct a Start block's pinned swimlane (the "in" dropdown) — an imported Start always comes back as "(auto)", since the pin can't be distinguished from PlantUML's own required lane hoisting once generated.
- Sequence diagram import splits the pasted text into two groups by node kind: all `participant` declarations rebuild the participant chain, everything else (messages, alt/opt/loop, notes, unrecognized raw lines) rebuilds the message chain — each group keeping its own relative order. A raw line that appeared between participant declarations in the original text is therefore always moved into the message-chain group on import.
- State diagram `note left/right of <name>` blocks are only reattached as a block comment when they immediately follow that same-named State/Composite State/Choice (matching how the generator always places them); otherwise — including a note placed right after a Transition, which can never carry a comment — the note's lines are kept as Raw PlantUML Line blocks instead. A Composite State's concurrent regions are each their own scope for this "immediately preceding statement" check: a note right after a `--` separator can only attach to a statement inside that same region.
- `escapeQuotedName` (used for participant names and message/note endpoints) replaces `"` with `'` and can't be reversed, so a name containing a literal `"` won't round-trip through export and re-import unchanged.
- Participant names (sequence diagrams) and State/Composite State/Choice names (state diagrams, all three sharing one namespace) must be unique. A new block whose default/copied name collides with an existing one is automatically renamed with a numeric suffix; renaming an existing block to a name already in use is rejected and reverts to the previous name. Neither of those automatic corrections triggers the rename-tracking described above (an earlier draft did, and was found — via manual testing in a live browser — to occasionally rewrite an unrelated, pre-existing block's references as a side effect; it was changed to never propagate instead). One consequence: duplicating a Composite State together with its nested children resolves the copies' name collisions, but any Transition inside the copy keeps pointing at the pre-collision name and needs to be repointed manually via its FROM/TO dropdown (it'll show a dangling-reference warning until then). Also, when a pasted PlantUML import's source text itself contains duplicate declarations, which occurrence keeps the original name and which gets suffixed isn't guaranteed to be "first occurrence wins" (it depends on block-creation event order), though uniqueness itself always holds.
- Choosing "change all" in the Swimlane rename dialog applies as a second, separate undo step from the rename that triggered the dialog (the dialog itself is asynchronous, so it can't be merged into the same undo group as the original edit) — undoing right after requires two Ctrl+Z presses to fully revert.
