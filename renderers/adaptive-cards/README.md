# Adaptive Cards renderer (prototype)

A portable renderer for abap2UI5 that is not a browser: it turns an
abap2UI5 response - the view XML of the portable profile and its JSON
model ([../../profiles/portable.md](../../profiles/portable.md)) - into an
[Adaptive Card](https://adaptivecards.io/) (schema 1.5), and an
`Action.Submit` payload of that card back into the next protocol request.
A bot, a chat integration or an Outlook actionable message could host an
abap2UI5 app with it.

Pure Node, no browser, no dependencies. The view XML is read by the
modules this repository already vendors from abap2UI5/mcp-server
([../../conformance/frontend/adapters/vendor/mcp-server/](../../conformance/frontend/adapters/vendor/mcp-server/source.json)):
`viewxml.mjs` (namespaces, bindings, event wires, expression bindings
without `eval`), `snapshot.mjs` (folding responses into slots and models,
`applyResponse`) and `appclient.mjs` (the model delta, `buildDelta`).

| File | |
|---|---|
| [render.mjs](render.mjs) | state -> card: `renderCard`, `cardText`, `liveSlots` |
| [mapping.mjs](mapping.mjs) | the control table - one entry per portable control, its card element and render function; the table below is generated from it |
| [submit.mjs](submit.mjs) | `Action.Submit` payload -> request: `submitToRequest`, `eventRequest`, `startRequest` |
| [host.mjs](host.mjs) | `createCardHost`: a minimal card host that speaks the protocol over HTTP (the client rules of [spec/transport.md](../../spec/transport.md#client-behaviour)) |
| [index.mjs](index.mjs) | the exports, `renderResponses` |
| [demo.mjs](demo.mjs) | a recorded response as card JSON, for the [designer](https://adaptivecards.io/designer) |
| [golden/](golden/) | golden cards of recorded responses ([../../traffic/](../../traffic/)) and of a synthetic sampler, held by `test/adaptive-cards.test.mjs` |

## Use it

```js
import { renderResponses, submitToRequest, createCardHost } from "@abap2ui5/protocol/renderers/adaptive-cards";

// pure: responses in, card out
const { card, unsupported, state } = renderResponses([response]);

// the way back: what the card host submitted -> the next request body
const r = submitToRequest(state, { event: "SAVE", "/NAME": "Ada" });
r.request;   // { S_FRONT: { ID, EVENT: "SAVE" }, MODEL: { NAME: "Ada" } } - post it as { value: r.request }

// or let the host do the HTTP
const host = createCardHost({ url: "https://host/sap/bc/z2ui5" });
await host.start("Z2UI5_CL_MY_APP");
host.render().card;
await host.submit({ event: "SAVE", "/NAME": "Ada" });
```

```bash
node renderers/adaptive-cards/demo.mjs                            # the BIND conformance app
node renderers/adaptive-cards/demo.mjs slots.popup-destroy 0 1    # two responses of a recorded check, folded
node renderers/adaptive-cards/demo.mjs --file response.json       # a response of your own
```

## How a response becomes a card

- **Slots.** Each open slot is a `Container` with the id `slot-MAIN`,
  `slot-POPUP`, `slot-POPOVER` (popup and popover above the page, style
  `emphasis`). NEST/NEST2 are processed and shown as a placeholder - they are
  not in portable profile v1 ([../../profiles/portable.md](../../profiles/portable.md#2-documents-slots-and-namespaces)).
- **Layers.** A message box and a popup are modal: while one is open it is
  the only interactive layer, and the layers below render read-only (texts,
  no inputs, no actions). A popover is not modal: it and MAIN are live, and a
  press in MAIN closes it first, as UI5 does.
- **Inputs carry their binding path as id** (`/NAME`, `/T_ITEMS/1/TEXT` for
  a cell of a table row). A card submits every input value with the
  action's data; `submitToRequest` compares each with the model the card was
  rendered from, writes the differing ones into the model in the type it
  holds there (a card submits strings) and sends them as the delta the UI5
  frontend builds - a scalar or a structure whole, table cells as `__delta`
  rows ([spec/request.md](../../spec/request.md#the-model-delta)).
- **Actions.** A backend event wire (`.eB(['SAVE'], ${/NAME}, 'x')`) is an
  `Action.Submit` with `data: { event: "SAVE", args: ["Ada", "x"], refs:
  ["/NAME"] }` - arguments resolved at render time, `refs` naming those read
  from the model so the reverse step reads them again after the edits of the
  same submit; an action of a popup or popover names its `slot`. A
  frontend-only wire (`.eF(...)`) is `data: { client: [...] }` and runs in
  the host without a roundtrip; the leave wire of a page's nav button is the
  reserved `___ZZZ_NAL`. A row event (`itemPress` with `${ID}`) is a
  `selectAction` per row, its arguments resolved against the row.
- **Messages.** A toast is a subtle `TextBlock` (its `onClose` event is
  raised by the host after the toast's duration); a message box a
  `Container` (`message-box`) with its text, its details **expanded** as
  plain text ([spec/actions.md](../../spec/actions.md#messages)) and one
  `Action.Submit` per box action (`data: { box: "CANCEL" }`), which raises
  the box's `onClose` event with the action as first argument.
- **Errors** are shown verbatim in a `RichTextBlock` `TextRun` - not
  markdown, so nothing of an error body is interpreted
  ([spec/errors.md](../../spec/errors.md#what-a-frontend-does-with-it)).
- **Tolerance.** An element outside the profile becomes a placeholder
  `TextBlock` and an entry of `unsupported` (`{ slot, control, id?, reason
  }`), as do event wires a card cannot raise (`change`, `liveChange`,
  `selectionChange`: the edit travels with the next action instead) and
  event arguments only a UI5 runtime can evaluate (`$event`,
  `${$parameters>/...}`, sent as `null`). An unknown follow-up action is
  skipped and logged by the host ([../../profiles/portable.md](../../profiles/portable.md#conformance)).
- **Follow-up actions** the host knows from `actions.wire` of
  [portable-v1.json](../../profiles/portable-v1.json): toasts, boxes,
  `START_TIMER` (it fires the event), `VIEW_SLOTS destroy`; the rest of the
  portable list has no counterpart in a card and is a logged no-op (focus,
  scroll, title, downloads, the `ROUTER` action - a card has no URL).

## Conformance

The frontend suite drives it as the in-process adapter `adaptive-cards`
(`npx abap2ui5-conformance frontend --adapter adaptive-cards`, profile
`portable`): a fresh host per check against the scripted backend; "fill"
types into the card input whose id is the path, "press" submits what a card
host submits for the action (its data merged with every input value).
Result in [../../conformance/RESULTS.md](../../conformance/RESULTS.md#frontend-suite):
every MUST and SHOULD that applies holds; the checks that need a URL, a
DOM, focus, a document title or a programmatic model edit are skipped.

## Limits of the prototype

- Events of inputs are not raised (cards have no change events in 1.5);
  `submit`/`search` become an `inlineAction`.
- Growing tables and lists show every row; tabs (IconTabBar) are stacked;
  a panel is always expanded; layout properties (flex alignment, grid spans,
  widths) are dropped.
- `DatePicker` is an `Input.Date` only for ISO values (`yyyy-MM-dd`), other
  formats stay text; `DateTimePicker` is text.
- Typed bindings are shown raw (no number or date formatting); formatters
  and `parts` bindings render empty.
- No URL: routing (`ROUTER`, the hash) is ignored, as a frontend without a
  URL may ([spec/navigation.md](../../spec/navigation.md#the-router-action)).

## Mapping

Generated from [mapping.mjs](mapping.mjs) (`node scripts/render-adaptive-cards.mjs`,
part of `npm run generate`; `npm test` fails when it is out of date).

<!-- adaptive-cards:mapping:begin - generated from mapping.mjs by scripts/render-adaptive-cards.mjs, do not edit -->

65 of 65 controls of portable profile v1 mapped.

### Layout & containers

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.Page | Container (flattened): title as heading TextBlock, nav button as Action.Submit | `showNavButton` + `navButtonPress` -> an Action.Submit "Back" that raises the wired event (the reserved `___ZZZ_NAL` for `_event_nav_app_leave`); header/footer bars render in place |
| sap.m.Shell | (none) - its app renders in place | - |
| sap.m.VBox | Container | flexbox alignment ignored |
| sap.ui.layout.form.SimpleForm | Container: each Label becomes the `label` of the input after it | the grid layout properties are ignored; a Label not followed by an input is a bold TextBlock |
| sap.m.HBox | ColumnSet (auto-width columns), or one ActionSet when every child is an action | - |
| sap.m.Panel | Container (style emphasis), headerText as bold TextBlock | `expandable`/`expanded` ignored - the content is always shown; `expand` not raised |
| sap.ui.layout.Grid | Container | spans ignored - children stack |
| sap.m.FlexBox | Container (direction Column) or ColumnSet (Row, the default) | alignment, gaps and wrap ignored |
| sap.m.ScrollContainer | Container | scrolling is the host's |
| sap.m.IconTabFilter | Container with the tab text as heading | - |
| sap.m.IconTabBar | Container: every tab stacked, each under its heading | `selectedKey` ignored - all tabs are shown; `select` not raised |
| sap.ui.layout.VerticalLayout | Container | - |
| sap.ui.core.Title | TextBlock (heading) | - |
| sap.ui.layout.HorizontalLayout | ColumnSet / ActionSet (as HBox) | - |

### Toolbars & bars

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.OverflowToolbar | ActionSet (all buttons) or ColumnSet | no overflow menu - everything is shown |
| sap.m.ToolbarSpacer | (nothing) | - |
| sap.m.Toolbar | ActionSet (all buttons) or ColumnSet | - |
| sap.m.Bar | ActionSet or ColumnSet of contentLeft, contentMiddle, contentRight | - |
| sap.m.OverflowToolbarButton | Action.Submit | as Button |

### Display

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.Text | TextBlock (wrap) | `maxLines` -> maxLines |
| sap.m.Label | TextBlock (bolder) - or the `label` of the input that follows | - |
| sap.m.Title | TextBlock (heading, bolder, medium) | - |
| sap.m.ObjectStatus | TextBlock "title: text", colored by `state` | `active` + `press` -> Action.Submit |
| sap.m.Link | Action.Submit (press wire) or Action.OpenUrl (href), else TextBlock | - |
| sap.m.ObjectIdentifier | TextBlock title (bolder) + TextBlock text (subtle) | `titleActive` + `titlePress` -> Action.Submit |
| sap.ui.core.HTML | TextBlock with the text of the HTML | tags, `<style>` and `<script>` dropped - reported as approximated |
| sap.ui.core.Icon | (nothing), or Action.Submit titled by its tooltip/icon name when it has a press wire | icons are decorative in a card |
| sap.m.ObjectNumber | TextBlock "number unit", colored by `state` | - |
| sap.tnt.InfoLabel | TextBlock (subtle) | `colorScheme` ignored |
| sap.m.ProgressIndicator | TextBlock with `displayValue` (or "<percent> %") | no bar |
| sap.m.Image | Image (`src` -> url, `alt` -> altText) | only http(s) and data URLs; a press wire -> selectAction |

### Input

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.Input | Input.Text (Input.Number for type Number; style password/email/tel/url), id = the `value` binding path | `submit` -> inlineAction; without it `showValueHelp` + `valueHelpRequest` -> inlineAction; `change`/`liveChange` are not raised (the edit travels with the next action); disabled or not editable -> TextBlock |
| sap.m.TextArea | Input.Text (isMultiline) | `liveChange` not raised |
| sap.ui.core.Item | a choice (`key` -> value, `text` -> title) of its Select/ComboBox | - |
| sap.m.CheckBox | Input.Toggle (`text` -> title, value "true"/"false") | `select` not raised |
| sap.m.Switch | Input.Toggle (`state`) | `change` not raised; title = `customTextOn` or "On" |
| sap.m.SegmentedButton | Input.ChoiceSet (style expanded) | `selectionChange` not raised |
| sap.m.SegmentedButtonItem | a choice of its SegmentedButton | - |
| sap.m.Select | Input.ChoiceSet (style compact), `selectedKey`, choices from the items (list binding or static) | `change` not raised |
| sap.m.DatePicker | Input.Date when the value is ISO (yyyy-MM-dd), else Input.Text | Input.Date speaks only yyyy-MM-dd; other `valueFormat`s stay text; `change` not raised |
| sap.m.SearchField | Input.Text, `search` -> inlineAction | `liveChange`/`suggest` not raised |
| sap.m.ComboBox | Input.ChoiceSet (style filtered) | `change` not raised |
| sap.m.MultiInput | Input.Text with the token texts | tokens are shown, not edited as tokens - approximated |
| sap.m.Token | a text of its MultiInput | - |
| sap.m.MultiComboBox | Input.ChoiceSet (isMultiSelect), `selectedKeys` joined by commas | `selectionChange`/`selectionFinish` not raised |
| sap.m.StepInput | Input.Number (`min`, `max`) | `step` ignored; `change` not raised |
| sap.ui.core.ListItem | a choice of its ComboBox/Select | `additionalText` dropped |
| sap.m.DateTimePicker | Input.Text | no date-time input in 1.5; `change` not raised |

### Actions

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.Button | Action.Submit, data { event, args } (a `.eF` wire: { client: [...] }) | `type` Emphasized/Accept -> style positive, Reject/Negative -> destructive; `enabled=false` -> isEnabled false; neighbouring buttons share one ActionSet |
| sap.m.ToggleButton | Input.Toggle (`pressed`) | `press` not raised - the state travels with the next action |

### Collections & tables

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.Column | a column of its Table; `header` -> the header row | popin and widths ignored |
| sap.m.ColumnListItem | TableRow; `press` -> selectAction of its cells; `selected` -> a leading Input.Toggle in a selectable table | - |
| sap.m.Table | Table (1.5): header row from the columns, a TableRow per row of the list binding | `itemPress` -> selectAction per row; `mode` *Select + `selected` binding -> Input.Toggle per row; growing ignored (every row is shown); `selectionChange` not raised |
| sap.m.List | FactSet (title -> value from description/info) - a Container per row when rows are pressable, selectable or custom | `itemPress`/item `press` -> selectAction; `mode` *Select + `selected` binding -> Input.Toggle; `delete`/`selectionChange` not raised |
| sap.m.StandardListItem | a fact (or row Container) of its List | `icon`, `counter`, `highlight` dropped |
| sap.m.CustomListItem | a row Container of its List | - |
| sap.m.Tree | FactSet / row Containers, the tree flattened depth first ("- " per level) | every node is shown expanded; `toggleOpenState` not raised |
| sap.m.StandardTreeItem | a fact of its Tree | `icon` dropped |

### Dialogs & popups

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.Dialog | Container (style emphasis): title heading, content, buttons as one ActionSet | rendered above the page, which turns read-only while it is open (modal); `afterClose` not raised |
| sap.m.Popover | Container (style emphasis): title heading, content, footer | no anchor - shown above the page, which turns read-only while it is open; `afterClose` not raised |

### Messages

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.m.MessageStrip | TextBlock colored by `type` (Error -> attention, Warning -> warning, Success -> good, Information -> accent) | `showCloseButton`/`close` dropped; formatted text shown as text |

### Tolerated (no visual)

| Control | Adaptive Card | Notes |
|---|---|---|
| sap.ui.core.CustomData | (nothing) | tolerated, no UI |
| sap.m.FlexItemData | (nothing) | tolerated, no UI |
| sap.ui.layout.GridData | (nothing) | tolerated, no UI |
| sap.m.OverflowToolbarLayoutData | (nothing) | tolerated, no UI |

<!-- adaptive-cards:mapping:end -->
