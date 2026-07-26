# Feature details

Full behavior, edge cases, and known limitations for each diagram type. For a high-level overview, see the [README](../README.md).

- [Common features](#common-features)
- [Activity diagrams](#activity-diagrams)
- [Sequence diagrams](#sequence-diagrams)
- [State diagrams](#state-diagrams)
- [Component diagrams](#component-diagrams)

## Common features

### PlantUML import

The "Import PlantUML" toolbar button opens a paste-in dialog (per diagram type) that parses PlantUML source back into blocks. Only the syntax subset that diagram type's own generator produces is recognized — anything else becomes a Raw PlantUML Line block rather than being dropped. A structurally broken paste (e.g. a missing `endif`/`end`/`}`) shows an error and leaves the workspace untouched. A pasted ` ```plantuml ` Markdown fence is recognized and stripped automatically.

Conditions/labels containing a literal `)` or `{` may not parse correctly, since the parser matches the first closing delimiter it finds. Pasting into the wrong diagram type's dialog parses as entirely unrecognized text — every line becomes a Raw PlantUML Line block, which still regenerates the same PlantUML (so it still previews correctly), even though none of it became real blocks.

### Notes on any block

Right-click a block and "Add Comment" to attach freeform text; it's rendered as a PlantUML `note` right after that block's own output. A "Note direction" right-click item (shown only on commented blocks) toggles the note between `right` (default) and `left`. Which blocks support notes, and how, varies by diagram type — see each section below.

### Live preview & source highlighting

Generated PlantUML is rendered via a PlantUML server (public by default, configurable — see below), debounced so dragging blocks doesn't spam requests. The editor/preview split is resizable by dragging the handle between them. Selecting a block highlights the PlantUML source text it generated, since the rendered SVG has no per-element mapping back to blocks.

### Auto-fill on first connection

Dropping a new relation/reference block (Message/Note/Activate/Deactivate on sequence diagrams, Transition/State Description on state diagrams, Dependency on component diagrams) from the toolbox and connecting it for the first time infers a starting value instead of leaving it blank. Per-diagram-type inference rules are described in each diagram's section below.

This only ever runs once, at the moment of first connection/placement; it never revisits an already-placed block later. Duplicating a block, PlantUML import, and workspace restore all keep their original from/to/target/state values untouched.

A couple of rough edges apply generally:

- Building a chain one block at a time (e.g. connect a Transition, then separately connect a State after it) can leave the later side at its default if the auto-fill already ran before that second block existed, since it's never retroactively re-evaluated. Inserting a new block between two already-connected ones resolves both sides at once and isn't affected.
- Undoing the deletion of a Message/Note/Transition is treated the same as placing a brand new block. If that undo also reconnects it into a stack, its restored from/to/target can get overwritten by a fresh guess instead of the original value — a deliberate trade-off, since Blockly can hand a freshly-dragged block the same ID a just-deleted one had, and treating undo specially would make that case indistinguishable from a genuinely new block.

### Single-chain vs. multi-chain generation

The activity/sequence statement chain generator only follows a single chain from its anchor block; additional disconnected chains elsewhere in the workspace are not included in the generated output. Every block on such a dropped chain (any type, including nested inside a container) gets a warning icon, so it's never silently invisible on the canvas.

State and Component diagrams are the exception: every top-level chain is included (there's no single "main flow" concept for a graph-shaped diagram), so nothing gets silently dropped there.

### Naming uniqueness

Participant and Actor names (sequence diagrams, sharing one namespace), State/Composite State/Choice/Fork/Join names (state diagrams, all five sharing one namespace), and Component names (component diagrams) must be unique. A new block whose default/copied name collides with an existing one is automatically renamed with a numeric suffix; renaming an existing block to a name already in use is rejected and reverts to the previous name.

Neither of those automatic corrections triggers rename-tracking (renaming a block normally updates every other field that referenced its old name) — an earlier version propagated automatic corrections too, but that occasionally rewrote an unrelated, pre-existing block's references as a side effect, so it was changed to never propagate. One consequence: duplicating a Composite State together with its nested children resolves the copies' name collisions, but any Transition inside the copy keeps pointing at the pre-collision name and needs to be repointed manually via its FROM/TO dropdown (it'll show a dangling-reference warning until then). Also, when a pasted PlantUML import's source text itself contains duplicate declarations, which occurrence keeps the original name and which gets suffixed isn't guaranteed to be "first occurrence wins" (it depends on block-creation event order), though uniqueness itself always holds.

### Text escaping

Free-form text (Action/Message/Note bodies, participant names) is escaped only where necessary:

- A literal `@` is replaced with the HTML entity `&#64;`, since `@enduml` (or any `@...` directive) appearing anywhere in a line terminates the diagram early.
- A `"` inside a participant/actor/message-endpoint name, or a component/dependency-endpoint name, is replaced with `'`, since PlantUML doesn't support escaping quotes inside a quoted identifier. This can't be reversed, so a name containing a literal `"` won't round-trip through export and re-import unchanged. Since a `'` in imported text could be one of these converted quotes or just a name the user typed with an apostrophe, Import PlantUML shows a one-time alert right after a successful sequence- or component-diagram import listing any name(s) that came in containing a `'`, rather than a persistent per-block warning that would otherwise dog legitimate apostrophe names (like "O'Brien") forever. The value itself is never changed by this notice.
- Semicolons, colons, and raw newlines render correctly unescaped and are left as-is.

### Persistence

Each diagram's workspace autosaves to `localStorage` and restores on load. JSON (workspace state) can be saved/loaded, and PlantUML text can be exported (next to the source preview) or copied as a fenced ` ```plantuml ` block for pasting into Markdown. Save/Export use the browser's native save dialog where supported (Chrome/Edge), falling back to a plain download elsewhere (e.g. Firefox).

### Editing tools

Undo and Clear (with a confirmation prompt) in the toolbar; dragging, duplicating, and deleting a block all act on the same range — the block plus everything connected below it.

### Configurable PlantUML server

`public/config.json` lets you point the preview and Export SVG/PNG at any PlantUML-compatible server instead of the public default; see the [README's Configuration section](../README.md#configuration).

## Activity diagrams

### Example

| Blocks | PlantUML output |
|---|---|
| ![Activity diagram example blocks](images/activity-example-blocks.png) | ![Activity diagram example output](images/activity-example-output.png) |

### Blocks

Start/Stop (optional, like plain PlantUML — see below), Action, If/Then/Else, While, Repeat, Fork, Partition, Swimlane, Raw PlantUML Line. If/Then/Else has an else-branch checkbox with editable then/else labels. Fork has a mutator for variable branch counts. Partition groups a sequence of statements (nestable). Swimlane switches the current lane for subsequent statements (reorder by dragging to control lane order). Raw PlantUML Line emits its text as a single line of PlantUML verbatim (unescaped) for syntax this app has no dedicated block for.

Renaming a Swimlane block prompts to apply the rename to just that block or to every other Swimlane block still sharing the old name (also updating a Start block pinned to that lane), but only when such other blocks actually exist.

### Swimlane ordering

PlantUML rejects a `|Name|` swimlane marker that appears after `start`. `activityWorkspaceToCode()` automatically hoists each distinct lane name's first occurrence to the very front of the generated body (ahead of `start`, if present); the real markers stay in place as harmless re-declarations. Column order follows the order lanes first appear in the generated text, so dragging Swimlane blocks to reorder them (or placing empty ones up front) controls the lane display order.

Which lane `start` itself is drawn in is determined by whichever `|Name|` declaration comes immediately before it — which, without help, is just whichever lane happens to sort last among the hoisted declarations above. The Start block has an "in" dropdown (populated from the Swimlane blocks in the workspace, defaulting to "(auto)") to pin it explicitly: when set, that lane's declaration is moved to the end of the hoisted list so `start` reliably lands there, even if that lane is otherwise unused (PlantUML just draws it as an empty column). If the pinned lane's name stops matching any Swimlane block (renamed or deleted), the Start block gets a warning icon.

Only a single top-level chain is ever included in the generated output — the one headed by the Start block, or (if there's no Start) the first top-level block in position order; every other disconnected chain on the canvas is dropped (see [Single-chain vs. multi-chain generation](#single-chain-vs-multi-chain-generation) above). This matters for Swimlane blocks specifically because the Start block has no previous-connection slot of its own: nothing can ever be placed directly ahead of it in the chain, so anything meant to be part of the diagram has to connect *after* Start, not before it. Importing PlantUML that has its own hoisted swimlane preamble used to leave that preamble's blocks stranded as a disconnected, invisible-in-the-output pair on the canvas; import now recognizes and discards that redundant preamble on its own (see [Known limitations](#known-limitations) below for the one shape it can't safely tell apart from ordinary content).

### Consistency warnings

- More than one Start block (the diagram still generates, but both get a warning icon).
- A Start block's pinned swimlane no longer existing.
- Any activity-diagram block (Action/If/While/Fork/Partition/Swimlane/Raw PlantUML Line, and a second Start's own chain) that isn't part of the diagram's generated output chain — disconnected, or on an alternate chain that gets dropped (see [Single-chain vs. multi-chain generation](#single-chain-vs-multi-chain-generation) above).

### Known limitations

- Start/Stop are plain, optional blocks (PlantUML itself doesn't require them either): Start allows at most one (a second one triggers a warning icon on both, though the diagram still generates), and Stop allows any number, including zero. New activity workspaces start empty rather than pre-populated with a Start/Stop pair.
- If the activity workspace has more than one disconnected block chain, only one is rendered: the chain containing the Start block if one exists, otherwise the top-most/left-most chain by position. Every block on every other chain gets a warning icon, per [Single-chain vs. multi-chain generation](#single-chain-vs-multi-chain-generation) above — none of them are silently dropped without one.
- Import recognizes its own hoisted swimlane preamble (the `|Name|` declarations PlantUML requires ahead of `start`) and reconstructs a Start block's pinned "in" dropdown from it when present, rather than leaving every imported Start at "(auto)". This recognition requires the leading declarations to exactly match the shape this app's own generator produces; hand-written or externally-produced PlantUML that merely happens to open with `|Name|` lines is left alone and rebuilt as ordinary Swimlane blocks instead. One narrow case is inherently ambiguous either way and always resolves to the ordinary-Swimlane-block reading: a single leading `|Name|` declaration whose name is never mentioned again anywhere else in the diagram looks identical to a lane pinned only for `start` with nothing else ever using it.
- Choosing "change all" in the Swimlane rename dialog applies as a second, separate undo step from the rename that triggered the dialog (the dialog itself is asynchronous, so it can't be merged into the same undo group as the original edit) — undoing right after requires two Ctrl+Z presses to fully revert.

## Sequence diagrams

### Example

| Blocks | PlantUML output |
|---|---|
| ![Sequence diagram example blocks](images/sequence-example-blocks.png) | ![Sequence diagram example output](images/sequence-example-output.png) |

### Blocks

Participant, Actor, Message, Alt/Opt/Loop, Note, Activate, Deactivate, Raw PlantUML Line — with dynamic dropdowns that track declared participants/actors, a mutator for optional else branches on Alt, and Participant/Actor blocks that chain together (freely mixed) so they can be reordered by dragging.

Actor renders as an `actor "Name"` stick-figure lifeline instead of Participant's boxed lifeline, but is otherwise fully interchangeable with Participant: same declaration area, same FROM/TO/TARGET dropdown pool, same name namespace, same rename-sync and dangling-reference-warning behavior. Renaming a Participant or Actor block automatically updates every Message/Note/Activate/Deactivate field that referenced its old name.

Activate/Deactivate each have a single TARGET dropdown and emit `activate "X"`/`deactivate "X"`; no color option. Their pairing is validated (see Consistency warnings below), but only within the diagram's generated message chain.

### Auto-fill on first connection

A Message/Note defaults to the participant/actor that received the nearest preceding Message (searching across Alt/Opt/Loop nesting); if none exists anywhere in the workspace yet, it falls back to the first declared Participant or Actor.

Activate/Deactivate use the same nearest-*preceding*-Message search as Message/Note but have no such fallback: Activate takes that message's recipient, Deactivate takes its sender; if no preceding Message exists yet, TARGET is left unset (surfacing as a dangling-reference warning) rather than guessing, and the block stays eligible for a later connection to resolve it.

See [Auto-fill on first connection](#auto-fill-on-first-connection) above for the general rules and rough edges this shares with the other diagram types.

### Consistency warnings

- Message/Note/Activate/Deactivate blocks referencing a participant that no longer exists (or, for Activate/Deactivate, whose TARGET was never resolved — see auto-fill above).
- An Activate/Deactivate pairing that's broken within the generated message chain (a Deactivate with no matching prior Activate for that participant, or an Activate never followed by a matching Deactivate). Pairs are matched LIFO per participant, following the chain's generation order through Alt/Opt/Loop branches, since PlantUML itself processes activate/deactivate sequentially regardless of which branch they're in. A disconnected extra message chain isn't checked, since it's already excluded from the generated output — see [Single-chain vs. multi-chain generation](#single-chain-vs-multi-chain-generation) above.
- Alt/Opt/Loop nesting deeper than 3 levels.
- Any sequence-diagram block (Message/Note/Activate/Deactivate/Alt/Opt/Loop/Raw PlantUML Line) that isn't part of the diagram's generated output chain — disconnected, or on an alternate chain that gets dropped (Participant/Actor declarations are exempt, since those are never dropped).

### Known limitations

- Participants and actors declare in the order they're chained together, freely mixed (reorder by dragging); a participant/actor left disconnected from that chain still appears, ordered by its Y-position in the workspace.
- Import splits the pasted text into two groups by node kind: all `participant`/`actor` declarations rebuild the shared declaration chain (interleaved Participant/Actor lines keep their original relative order), everything else (messages, alt/opt/loop, notes, unrecognized raw lines) rebuilds the message chain — each group keeping its own relative order. A raw line that appeared between participant/actor declarations in the original text is therefore always moved into the message-chain group on import.

## State diagrams

### Example

| Blocks | PlantUML output |
|---|---|
| ![State diagram example blocks](images/state-example-blocks.png) | ![State diagram example output](images/state-example-output.png) |

### Blocks

State, Choice, Fork, Join, Transition, Composite State, State Description, Raw PlantUML Line. Transition's from/to fields are dynamic dropdowns listing every declared State/Composite State/Choice/Fork/Join, `[*]` (the start/end pseudostate), and shallow/deep history tokens (bare `[H]`/`[H*]`, or `<Composite State name>[H]`/`<Composite State name>[H*]` referencing a specific composite's history from outside it); its label is optional. There's no separate Start/End block — `[*]` is always the first FROM/TO option on Transition itself (see [Known limitations](#known-limitations-2) below for why a dedicated block was tried and dropped).

Composite State groups a sequence of states/transitions under a nested `state Name { ... }` block, can nest arbitrarily deep, and has a mutator (gear icon) for adding concurrent regions separated by `--` or `||` (only the first boundary's choice actually affects PlantUML's rendering — see below).

Choice/Fork/Join each declare a `<<choice>>`/`<<fork>>`/`<<join>>` pseudostate, connected to/from other states just like a regular State.

State Description attaches a `<name> : text` description line to a declared State/Composite State/Choice/Fork/Join (a different construct from a Note — see below); add more than one block referencing the same state for multiple description lines.

Renaming a State, Composite State, Choice, Fork, or Join block automatically updates every Transition and State Description field that referenced its old name.

Notes are supported on State, Composite State, Choice, Fork, and Join blocks (rendered as `note X of <name>`, explicitly anchored to that block's own name); Transition and State Description have no "Add Comment" option, since neither has a name of its own to anchor a note to, and PlantUML's implicit `note right`/`note left` form can fail to render depending on what precedes a transition.

### Auto-fill on first connection

A Transition defaults its from/to to the nearest preceding/following State/Composite State/Choice within its own connected chain (searching across Composite State and concurrent-region nesting) — a Transition not yet connected to anything is left alone.

A State Description defaults its STATE to the nearest *preceding* State/Composite State within its own connected chain only (no forward/TO side); unlike Transition, a preceding Choice/Fork/Join is *not* treated as State/Composite State's equivalent — hitting one (or the head of a Composite State's own body, or nothing at all) stops the search and leaves STATE unset rather than guessing further back, surfacing as a dangling-reference warning until the user connects it after a real State/Composite State or picks one manually.

A known rough edge: a Transition's guessed "to" can cross into an unrelated concurrent region and pick up that region's first State/Choice, since regions are actually independent flows rather than a sequence.

See [Auto-fill on first connection](#auto-fill-on-first-connection) above for the general rules this shares with the other diagram types.

### Consistency warnings

- A Transition's from/to or State Description's referenced state that no longer exists (State Description also warns if it references `[*]` or a history token, which it never accepts as a valid target — see [Known limitations](#known-limitations-2) below).
- A State/Composite State/Choice/Fork/Join name containing a space or `"` (see [Known limitations](#known-limitations-2) below).

### Known limitations

- State/Composite State/Choice/Fork/Join names must be simple identifiers with no spaces or `"` — PlantUML's state-diagram parser misparses the diagram type entirely, or rejects the syntax outright, when a Transition's endpoints are quoted or contain a space. The value itself is never blocked or rewritten (so a name saved before this check existed, or one that comes in through JSON restore/PlantUML import, is never silently changed), but a NAME field containing either character gets a red outline while you're actively editing it, and the block carries a warning icon for as long as the invalid character remains, even after you click away.
- The `||` concurrent-region separator only affects a Composite State's actual PlantUML layout when chosen on its first boundary: mixing `--`/`||` across a single Composite State's boundaries never errors, but every boundary after the first renders exactly as if it had used the first boundary's symbol. To avoid a misleading UI, the mutator's separator dropdown is shown only on the first boundary; every later boundary shows a read-only label that always mirrors it, and generation likewise always emits the same symbol at every boundary. Importing a source that does mix them normalizes to the first symbol on re-export, matching what's actually rendered.
- State Description's STATE dropdown never offers `[*]` or a history token (`[H]`/`[H*]`) as a target, since PlantUML's `<name> : text` syntax describes a declared state rather than a pseudostate; referencing one anyway (e.g. via JSON restore of a hand-edited save) is flagged with the same dangling-reference warning as an unresolved name. The dropdown always leads with an explicit "(unset)" option (an empty STATE) — shown when auto-fill found nothing to attach to, or after manually picking it — which warns with a dedicated "not attached to any state" message rather than the generic dangling-reference one.
- A dedicated Start/End block (colored and separate from Transition, mirroring Activity's Start/Stop) was prototyped for the `[*]` start/end pseudostate but ultimately not added: unlike Activity diagrams, where `start`/`stop` are real PlantUML statements and block order alone implies the flow, PlantUML's state-diagram `[*]` is never declared on its own — it only ever appears as one endpoint of an explicit `-->` transition. A block with no such arrow would generate nothing, and drawing the arrow still requires the existing Transition block, so a dedicated block would add UI without adding capability. `[*]` remains reachable the same way any other state is: pick it from Transition's FROM/TO dropdown (it's always the first option).
- `note left/right of <name>` blocks imported from PlantUML are only reattached as a block comment when they immediately follow that same-named State/Composite State/Choice (matching how the generator always places them); otherwise — including a note placed right after a Transition, which can never carry a comment — the note's lines are kept as Raw PlantUML Line blocks instead. A Composite State's concurrent regions are each their own scope for this "immediately preceding statement" check: a note right after a `--` separator can only attach to a statement inside that same region.

## Component diagrams

### Example

| Blocks | PlantUML output |
|---|---|
| ![Component diagram example blocks](images/component-example-blocks.png) | ![Component diagram example output](images/component-example-output.png) |

### Blocks

Component, Component Style, Dependency, Raw PlantUML Line. Component declares a `component "Name" { ... }` block and can nest arbitrarily deep (a component inside another component's body) to express containment; a component with no nested children still renders with empty braces.

Component Style sets `skinparam componentStyle` for the whole diagram via a `rectangle`/`uml1`/`uml2` dropdown; **the diagram defaults to `rectangle` even if you never place this block** (PlantUML's own default is the older `uml1` icon style).

Dependency's from/to fields are dynamic dropdowns listing every declared Component (nested ones included) and express a shared, many-to-many relation as a single `"From" --> "To"` arrow with an optional label; it's the one relation kind this app generates (no separate dependency-vs-association arrow styles, and no inheritance/is-a).

You can drop a Dependency or Component Style block anywhere, including nested inside a Component's body, for whatever organization makes sense while editing — but every Dependency line is always emitted at the very end of the generated PlantUML (after every Component declaration), and every Component Style line is always emitted at the very front (right after `@startuml`), regardless of where its block sits. PlantUML doesn't reliably resolve a `-->` relation left inside a nested `component { }` scope — the referenced component can come back as a duplicate "ghost" node instead — so this hoisting keeps the rendered diagram correct no matter how you arrange the blocks. Dropping more than one Component Style block emits more than one `skinparam componentStyle` line, in their original relative order; PlantUML itself applies whichever one appears last.

Renaming a Component automatically updates every Dependency field that referenced its old name, same as the other diagram types.

### Auto-fill on first connection

A Dependency works the same way as a Transition (nearest preceding/following Component within its own connected chain, searching across nested Components), but — like Activate/Deactivate — has no first-Component-in-the-workspace fallback for a side that finds no match, since Dependency has no stable placeholder value like Transition's `[*]`; an unresolved side is simply left as-is (surfacing as a dangling-reference warning).

See [Auto-fill on first connection](#auto-fill-on-first-connection) above for the general rules this shares with the other diagram types.

### Consistency warnings

- A Dependency's from/to referencing a Component that no longer exists.

### Known limitations

- This is the newest, most minimal diagram type: only a single relation kind is generated (`"From" --> "To"`, no distinct dependency/association arrow styles), and there's no support for inheritance/is-a, interfaces (`()`), or `package`/`node`/`folder` container syntax — use Raw PlantUML Line for those.
- Component names have no character restrictions beyond the shared `@`/`"` escaping (see [Text escaping](#text-escaping) above); they don't share State/Composite State/Choice's simple-identifier constraint since they're always emitted quoted.
- Unlike the other three diagram types, its importer doesn't reattach `note ... end note` as a block comment at all (component diagrams have no Note support, generated or imported) — a note block is always kept as Raw PlantUML Line lines, one per line.
- Every Dependency line is hoisted to the very end of the generated text regardless of where its block sits (see Blocks above); if a Raw PlantUML Line's text happens to match a Dependency line's exact shape (`"X" --> "Y"`, optionally with `: label`), it gets hoisted along with the real ones too, since a raw line's meaning is never interpreted. Similarly, every `skinparam componentStyle rectangle`/`uml1`/`uml2` line is hoisted to the very front regardless of where its Component Style block sits; importing PlantUML that has no such line at all still produces a diagram that regenerates with a synthesized `skinparam componentStyle rectangle` line up front (the default applies even without an explicit block), so a round trip through this app is not always byte-for-byte identical to the original source in that one respect. A `skinparam componentStyle` line with any value other than `rectangle`/`uml1`/`uml2` is kept as a Raw PlantUML Line (not recognized as Component Style) and is not hoisted.
