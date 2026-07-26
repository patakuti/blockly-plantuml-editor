# Blockly PlantUML Editor

A no-code editor for [PlantUML](https://plantuml.com/) **activity diagrams**, **sequence diagrams**, **state diagrams**, and **component diagrams**, built with [Blockly](https://developers.google.com/blockly). Drag blocks together and see a live PlantUML preview update as you edit — no PlantUML syntax required.

## Features

- **Four diagram types**: Activity, Sequence, State, and Component, each with its own dedicated toolbox of blocks mapping onto that diagram type's PlantUML constructs.
- **PlantUML import**: paste existing PlantUML source in and it's parsed back into blocks, per diagram type; unrecognized syntax becomes a Raw PlantUML Line block instead of being dropped.
- **Live preview**: rendered via a PlantUML server (public by default, configurable) as you edit, with the generated source shown alongside and highlighted per selected block.
- **Consistency warnings**: blocks referencing a deleted/renamed element, broken Activate/Deactivate pairing, disconnected chains, and other structural issues are flagged with a warning icon.
- **Auto-fill on connect**: dropping a new relation/reference block (Message, Transition, Dependency, etc.) infers a sensible default endpoint instead of leaving it blank.
- **Notes on blocks**: attach freeform notes via right-click "Add Comment".
- **Persistence**: autosaves to `localStorage`; JSON save/load and PlantUML export/copy-as-Markdown.
- **Editing tools**: Undo, Clear, and drag/duplicate/delete acting on a block plus everything connected below it.
- **Configurable PlantUML server**: point the preview at any PlantUML-compatible server.

Each diagram type has its own independent Blockly workspace; switching tabs never loses in-progress edits in the other diagram.

For the full behavior, edge cases, and known limitations of each diagram type, see [docs/FEATURES.md](docs/FEATURES.md).

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
    sequence/    # sequence_* block definitions, mutators, toolbox, validation, FROM/TO/TARGET auto-fill
    state/       # state_* block definitions, toolbox, validation, comment restriction, FROM/TO auto-fill
    component/   # component_* block definitions, toolbox, validation, rename-sync, FROM/TO auto-fill
    common/      # cross-diagram block behavior (unified drag/duplicate/delete range, note direction menu, FROM/TO/TARGET auto-fill eligibility tracking, nested-chain enumeration)
  generators/
    common/      # shared statement-walking, note-wrapping, escaping/unescaping helpers
    activityGenerator.ts
    sequenceGenerator.ts
    componentGenerator.ts
  import/        # PlantUML text -> blocks: per-diagram-type (activity/sequence/state) parser + workspace builder, plus shared line-cursor/preprocessing helpers
  preview/       # PlantUML server URL + hex-encoding, and the preview/source panel
  workspace/     # per-diagram Blockly workspace lifecycle, localStorage/JSON/file persistence
  ui/            # tab bar, toolbar (Save/Load JSON, Undo, Clear, server setting, Import PlantUML), splitter, import dialog
  types/         # ambient type declarations (File System Access API)
  main.ts        # wires everything together
tests/
  generators/    # unit tests for the code generators, run against headless Blockly workspaces
  import/        # unit tests for all three diagram types' PlantUML import parsers and their parse-build-regenerate round trips
  blocks/        # unit tests for FROM/TO/TARGET auto-fill (eligibility tracking, nested-chain enumeration, sequence/state-specific inference)
```

## Testing

Unit tests cover the block-to-PlantUML code generators (single blocks, nested containers, mutator state round-trips, text escaping, and the activity/sequence-diagram consistency checks) using headless `Blockly.Workspace` instances — no browser required. The same approach covers the PlantUML import parser (each recognized construct, nesting, error cases) and a round trip (generate → parse → rebuild → regenerate) that checks the two directions agree. UI behavior and PlantUML rendering are verified manually/interactively rather than through automated E2E tests.

```sh
npm test
```
