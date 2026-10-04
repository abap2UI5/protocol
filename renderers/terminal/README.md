# Terminal renderer

A portable renderer for abap2UI5 that runs in a terminal: an abap2UI5 app -
on the abap2UI5 node runtime, on cap2UI5 or on an SAP system - as a
keyboard-driven text screen. It speaks the roundtrip protocol to the
backend's endpoint, renders the views of the portable profile
([../../profiles/portable.md](../../profiles/portable.md)) as terminal
widgets and turns the keys back into protocol requests. A `--print` mode
renders the first screen once as plain text, for logs, CI and screen
readers.

Pure Node, no native modules, no dependencies: ANSI escape codes and
`node:readline` are all it needs. The view XML is read by the modules this
repository vendors from abap2UI5/mcp-server
([../../conformance/frontend/adapters/vendor/mcp-server/](../../conformance/frontend/adapters/vendor/mcp-server/source.json))
through the view helpers it shares with the Adaptive Cards renderer
([../common/](../common/view.mjs): bindings, aggregations, list bindings,
event wires, and the model delta of the next request).

```
 abap2UI5 - conformance - bind
conformance - bind
================================================================
>start_______<
[1___________]
[ ] Flag
[Berlin______]
[10115_______]
[ Check ] [ Add row ]
1 | [one_________] | [ ]
2 | [two_________] | [ ]
3 | [three_______] | [ ]


type to edit  Tab next  F1 keys  Ctrl+C quit
```

The screen of the conformance app BIND, 64 x 15, without colors (with
them, the header and the status line are reversed and the focused field is
highlighted instead of marked with `>` `<`).

| File | |
|---|---|
| [bin/abap2ui5-tui.mjs](bin/abap2ui5-tui.mjs) | the CLI (`abap2ui5-tui`) |
| [session.mjs](session.mjs) | `createSession`: the protocol over HTTP - the client rules of [spec/transport.md](../../spec/transport.md#client-behaviour), basic auth and cookies for an SAP system, follow-up actions, the hash history |
| [app.mjs](app.mjs) | `createTerminalApp`: the state machine - focus, editing, pick lists, keys; `frame()` (the screen) and `print()` (the text) |
| [render.mjs](render.mjs) | state -> screen document: the layers (MAIN, popup, popover, message box), their blocks and widgets |
| [mapping.mjs](mapping.mjs) | the control table - one entry per portable control, what it becomes and its render function; the table below is generated from it |
| [layout.mjs](layout.mjs) | blocks -> lines at a width: wrapping, columns, tables, frames |
| [text.mjs](text.mjs) | display width, sanitising, truncation, glyphs, ANSI styles, `NO_COLOR` |
| [tty.mjs](tty.mjs) | the real terminal: raw keys in, frames out |
| [index.mjs](index.mjs) | the exports, `printResponses` |
| [golden/](golden/) | golden screens of recorded responses ([../../traffic/](../../traffic/)), held by `test/terminal.test.mjs` (`UPDATE_GOLDEN=1` rewrites them) |

## Use it

```bash
npx abap2ui5-tui http://localhost:3000/ --app Z2UI5_CL_MY_APP
npx abap2ui5-tui "https://host/sap/bc/z2ui5?sap-client=100" --app Z2UI5_CL_MY_APP --user DEVELOPER   # password: ABAP2UI5_PASSWORD
npx abap2ui5-tui http://localhost:4004/rest/root/z2ui5 --app Z2UI5_CL_MY_APP --print --width 100
```

| Option | |
|---|---|
| `<url>` | the backend endpoint: the node runtime's root, a cap2UI5 service, an SAP ICF node; its query (`sap-client`, `sap-language`) stays on every request |
| `--app <CLASS>` | the app to start (`?app_start=<CLASS>`); without it the backend's start app |
| `--user`, `--password` | basic authentication; the password may come from `ABAP2UI5_PASSWORD` instead of the command line |
| `--cookie "<name>=<value>; ..."` | cookies to send (a logon ticket); cookies the backend sets are kept, as a browser keeps them |
| `--header "<name>: <value>"` | an extra request header, repeatable |
| `--print` | render the first screen once as text and exit - no keys, no timers; what could not be rendered goes to stderr; exit code 1 when the backend answered with an error |
| `--width <n>` | the width of `--print` (default: the terminal's, else 80) |
| `--no-color` / `--color` | colors off / on; default: on for a TTY unless `NO_COLOR` is set (or `TERM=dumb`); `FORCE_COLOR` forces them |
| `--ascii` / `--unicode` | the frame glyphs; default: Unicode box drawing when the locale is UTF-8, ASCII for `--print` |

```js
import { createSession, createTerminalApp, runTui, printResponses } from "@abap2ui5/protocol/renderers/terminal";

// a backend, a screen, keys
const session = createSession({ url: "http://localhost:3000/" });
const app = createTerminalApp({ session, width: 80, height: 24 });
await session.start("Z2UI5_CL_MY_APP");
await app.key("tab"); await app.type("Ada"); await app.key("enter");
app.frame().lines;      // the screen, line by line
app.print();            // the whole screen as text, overlays below the page
await runTui({ app });  // or hand it the real terminal

// pure: recorded responses in, text out
const { text, unsupported } = printResponses([response], { width: 80 });
```

## Keys

| Key | |
|---|---|
| Tab / Shift+Tab | the next / previous field or action |
| Up / Down | the field or action above / below (nearest line, then nearest column); in a StepInput: step the number; in a TextArea: the line above / below |
| Left / Right | move the cursor in a field; pick the previous / next option of a pick list; elsewhere the previous / next widget |
| Enter | press the focused button, link or row; in a field: commit it (and raise `submit` / `search`); on a pick list: open the list |
| Space | toggle a check box, switch or row selection; press a button |
| Esc | close the open pick list, the key help or a popover |
| Alt+Left, Ctrl+B / Alt+Right | back / forward in the hash history; with no history to go back to, Back presses the page's nav button |
| PageUp / PageDown | scroll the page |
| F4 | the value help of the field (`valueHelpRequest`) |
| Ctrl+U, Home, End | clear the field, start, end |
| F1 | the key help |
| Ctrl+R | restart the app from its start URL |
| Ctrl+C, Ctrl+Q | quit (the stateful session on the server is terminated) |

The status line shows the keys of the focused widget - and, after a
roundtrip, what the terminal did with follow-up actions it has no
counterpart for (`open https://...`, `copied to the clipboard`,
`outside the portable profile: CONTROL_BY_ID - skipped`) and the controls
it could not render.

## How a response becomes a screen

- **Layers.** MAIN is the page; POPUP, POPOVER and the message box are
  overlay frames above it (centred on the screen, or printed below the page
  with `--print`). A message box and a popup are modal: only their widgets
  take the focus. A popover is not: the page stays live, and Esc or an
  action of the page closes the popover first, as UI5 does. NEST/NEST2 are
  processed and shown as a placeholder - they are not in portable profile v1.
- **Widgets.** Fields `[value____]`, toggles `[x] text`, pick lists
  `[Berlin v]`, buttons `[ text ]`, links `[text]`; the focused one is
  drawn reversed (with `--no-color`: its brackets become `>` `<`). A
  disabled or read-only control is drawn dim and skipped by the focus.
- **Edits** are those of a UI5 Input: written into the model when they are
  committed - the focus leaves the field, Enter, an action fires - and only
  when the value changed, in the type the model holds there (a number stays
  a number). They travel with the next event of that model as the delta the
  UI5 frontend builds: only the edited paths, a scalar or a structure
  whole, table cells as `__delta` rows
  ([spec/request.md](../../spec/request.md#the-model-delta)). Edits made
  while a roundtrip is in flight survive its model push.
- **Events.** A press resolves the wire's arguments when it fires
  (`${/ABS}`, `${REL}` against the row, `${$source>/prop}`, the event
  parameters of profiles/portable.md section 5 such as `${$parameters>/value}`);
  a frontend-only wire (`.eF`) runs without a roundtrip. Unlike a card, a
  terminal raises the events of fields: `change`, `select`,
  `selectionChange` when the value is committed, `submit` and `search` on
  Enter. One roundtrip at a time: what fires meanwhile is queued and built
  when it leaves.
- **Messages.** A toast is a `>> text` line above the page (its `onClose`
  is raised after its duration); a message box an overlay frame with its
  text, its details **expanded** as plain text and a button per action; an
  error a red `Error:` block with the body verbatim
  ([spec/errors.md](../../spec/errors.md#what-a-frontend-does-with-it)).
- **Text is sanitised.** Every control character a backend sends (in a
  view, a model value, an error body) is replaced before it reaches the
  terminal, so no response can move the cursor, retitle the window or write
  the clipboard. Wide characters take two columns; what does not fit is cut
  with an ellipsis.
- **Tolerance.** An element outside the profile is a visible placeholder
  `[? <control> - not rendered]`, reported in the status line and by
  `unsupported` (profiles/portable.md#conformance); an unknown follow-up
  action is skipped and named in the status line.
- **Follow-up actions** of `actions.wire` in
  [portable-v1.json](../../profiles/portable-v1.json): toasts, boxes,
  `START_TIMER`, `SET_FOCUS` (the focus moves to the widget with that id),
  `SCROLL_TO`, `SET_TITLE` (the header line and the window title),
  `CLIPBOARD_COPY` (OSC 52), `URLHELPER` / `OPEN_NEW_TAB` (the URL in the
  status line), `LOCATION_RELOAD`, `HASH_BACK`, `BUSY_INDICATOR`,
  `INVISIBLE_MESSAGE` (the status line); the rest is a logged no-op.
- **Routing.** The session keeps the hash a browser would show and its
  history, synchronised once per response like the UI5 router (KEEP /
  FRESH routes, the caller's entry repointed on a `nav_app_call`, the
  app-state hash); every request carries it as `HASH`; Back restores the
  route it lands on with an app-start-shaped request
  ([spec/navigation.md](../../spec/navigation.md#the-router-action)).
- **Transport** ([spec/transport.md](../../spec/transport.md)):
  `sap-contextid-accept: header` on every POST, the last valid
  `sap-contextid` kept and sent back, the CSRF token handshake of a token
  layer, no retry of a 500, a 120 s timeout, the terminate HEAD on quit.

## Conformance

The frontend suite drives it as the in-process adapter `terminal`
(`npx abap2ui5-conformance frontend --adapter terminal`, profile
`portable`) through its state machine, the way a user does: `fill` Tabs to
the field and types the value, `press` Tabs to the action and presses
Enter, `back` is Alt+Left; the state is read from the screen. Result in
[../../conformance/RESULTS.md](../../conformance/RESULTS.md#frontend-suite):
every MUST and SHOULD that applies holds, the router checks included; the
checks that need a DOM or a programmatic model edit are skipped.

## Limits

- No calendar, no value-help dialog of its own, no file upload: dates are
  typed, F4 raises the app's `valueHelpRequest`.
- `liveChange` is raised once per committed edit, not per keystroke.
- Growing tables and lists show every row (the screen scrolls); tabs
  (IconTabBar) are stacked; a panel is always expanded; layout properties
  (flex alignment, grid spans, widths) are dropped.
- Typed bindings are shown raw (no number or date formatting); formatters
  and `parts` bindings render empty.
- `sap.m.RadioButton` / `RadioButtonGroup` are not in portable profile v1
  and render as placeholders.
- Images are their alt text; a link's `href` is shown, not opened.

## Mapping

Generated from [mapping.mjs](mapping.mjs) (`node scripts/render-terminal.mjs`,
part of `npm run generate`; `npm test` fails when it is out of date).

<!-- terminal:mapping:begin - generated from mapping.mjs by scripts/render-terminal.mjs, do not edit -->

65 of 65 controls of portable profile v1 mapped.

### Layout & containers

| Control | Terminal | Notes |
|---|---|---|
| sap.m.Page | a header line (nav button, title, header content on the right) over a rule, then the content and the footer | `showNavButton` + `navButtonPress` -> the button `[ < ]` that raises the wired event (the reserved `___ZZZ_NAL` for `_event_nav_app_leave`); Alt+Left presses it when the history has no entry to go back to |
| sap.m.Shell | (none) - its app renders in place | - |
| sap.m.VBox | a stack | flexbox alignment ignored |
| sap.ui.layout.form.SimpleForm | label-field rows, the labels in one column | a Label followed by a field becomes one row; several fields after one label share the row; the grid layout properties are ignored |
| sap.m.HBox | one line of inline items, or columns side by side (stacked when they do not fit the width) | - |
| sap.m.Panel | a frame titled by `headerText` | `expandable`/`expanded` ignored - the content is always shown; `expand` not raised |
| sap.ui.layout.Grid | a stack | spans ignored - children stack |
| sap.m.FlexBox | a stack (direction Column) or a line / columns (Row, the default) | alignment, gaps and wrap ignored |
| sap.m.ScrollContainer | a stack | the screen scrolls as a whole |
| sap.m.IconTabFilter | a heading with the tab text (and count), its content below | - |
| sap.m.IconTabBar | every tab stacked, each under its heading | `selectedKey` ignored - all tabs are shown; `select` not raised (reported) |
| sap.ui.layout.VerticalLayout | a stack | - |
| sap.ui.core.Title | a heading (bold) | - |
| sap.ui.layout.HorizontalLayout | a line / columns (as HBox) | - |

### Toolbars & bars

| Control | Terminal | Notes |
|---|---|---|
| sap.m.OverflowToolbar | one line of inline items (wrapped when too wide) | no overflow menu - everything is shown; a ToolbarSpacer pushes what follows to the right |
| sap.m.ToolbarSpacer | the flexible space of its toolbar line | - |
| sap.m.Toolbar | one line of inline items (wrapped when too wide) | as OverflowToolbar |
| sap.m.Bar | one line: contentLeft, contentMiddle, contentRight | - |
| sap.m.OverflowToolbarButton | a button `[ text ]` | as Button |

### Display

| Control | Terminal | Notes |
|---|---|---|
| sap.m.Text | text, wrapped at the width | `maxLines` cuts after that many lines (with an ellipsis) |
| sap.m.Label | bold text - or the label column of the field that follows | - |
| sap.m.Title | a heading (bold) | - |
| sap.m.ObjectStatus | text "title: text", colored by `state` | `active` + `press` -> a link |
| sap.m.Link | a link `[text]` (press wire), else underlined text with the `href` | a terminal does not open URLs - the `href` is shown |
| sap.m.ObjectIdentifier | the title (bold) and the text (dim) below it | `titleActive` + `titlePress` -> a link |
| sap.ui.core.HTML | the text of the HTML | tags, `<style>` and `<script>` dropped - reported as approximated |
| sap.ui.core.Icon | a short text in parentheses (`sap-icon://add` -> `(+)`, other icons by name); a button when it has a press wire | the table of short texts is `ICON_TEXT` in mapping.mjs |
| sap.m.ObjectNumber | text "number unit", colored by `state` | `emphasized` -> bold |
| sap.tnt.InfoLabel | text in parentheses | `colorScheme` ignored |
| sap.m.ProgressIndicator | a bar `[#####-----] 50 %` (`displayValue` when set) | - |
| sap.m.Image | `[image: alt]` - a link when it has a press wire | a terminal shows no images |

### Input

| Control | Terminal | Notes |
|---|---|---|
| sap.m.Input | an editable field `[value____]` (masked for type Password), edited in place | Enter raises `submit` (`${$parameters>/value}`), F4 raises `valueHelpRequest` when `showValueHelp`; `change` and `liveChange` are raised once when the edit is committed (leaving the field, Enter) - not per keystroke; disabled or not editable -> not focusable |
| sap.m.TextArea | a multi-line field (`rows` lines high, growing with the text) | Enter inserts a line feed; `change`/`liveChange` raised once when the edit is committed |
| sap.ui.core.Item | an option (`key`, `text`) of its Select/ComboBox | - |
| sap.m.CheckBox | a toggle `[x] text` | Space toggles and raises `select` (`${$parameters>/selected}`) |
| sap.m.Switch | a toggle `[On ]` / `[Off]` | Space toggles and raises `change` (`${$parameters>/state}`); `customTextOn`/`customTextOff` replace On/Off |
| sap.m.SegmentedButton | a pick list drawn expanded `[ (o) A  ( ) B ]` | Left/Right picks and raises `selectionChange` |
| sap.m.SegmentedButtonItem | an option of its SegmentedButton | - |
| sap.m.Select | a pick list `[Berlin    v]`: Left/Right step through the options, Enter opens the list | picking raises `change` |
| sap.m.DatePicker | an editable field holding the value as the model has it | no calendar - the value is typed (in `valueFormat`, shown as placeholder); `change` raised on commit (`value`, `valid`) |
| sap.m.SearchField | an editable field; Enter raises `search` | `search` gets `query`; `liveChange` raised on commit (`newValue`); `suggest` not raised |
| sap.m.ComboBox | a pick list (as Select); an editable field when it has no items | picking raises `change` (`value`) |
| sap.m.MultiInput | the token texts, then an editable field | tokens are shown, not edited as tokens - approximated (reported) |
| sap.m.Token | a text `{text}` of its MultiInput | - |
| sap.m.MultiComboBox | a pick list of several `[A, B    v]`: Enter opens the list, Space ticks, Enter confirms | confirming raises `selectionChange` and `selectionFinish` |
| sap.m.StepInput | an editable number field; Up/Down step by `step` within `min`/`max` | `change` raised on commit (`value`) |
| sap.ui.core.ListItem | an option of its ComboBox/Select | `additionalText` dropped |
| sap.m.DateTimePicker | an editable field (as DatePicker) | no calendar; `change` raised on commit |

### Actions

| Control | Terminal | Notes |
|---|---|---|
| sap.m.Button | a button `[ text ]`; Enter (or Space) presses it | an icon-only button shows the icon's short text (`[ + ]`); `type` Emphasized -> bold, Accept -> green, Reject -> red; `enabled=false` or no press wire -> dim, not focusable |
| sap.m.ToggleButton | a toggle `[x] text` | Space toggles `pressed` and raises `press` (`${$parameters>/pressed}`) |

### Collections & tables

| Control | Terminal | Notes |
|---|---|---|
| sap.m.Column | a column of its Table; `header` -> the header line | popin and widths ignored - the widths follow the content and the screen |
| sap.m.ColumnListItem | a row of its Table; `press` -> the row is an action (Enter); `selected` -> a leading `[x]` in a selectable table | - |
| sap.m.Table | a grid: header line, a rule, a line per row, the columns fitted to the width (cut with an ellipsis); the screen scrolls | `itemPress` -> every row is an action (`>` marks the focused one); `mode` *Select + `selected` binding -> a `[x]` per row; growing ignored (every row is shown); `selectionChange` raised when a row is ticked |
| sap.m.List | a grid without header: title, description (dim), info (colored by `infoState`) | `itemPress`/item `press` -> the row is an action; `mode` *Select + `selected` -> `[x]`; `delete` not raised |
| sap.m.StandardListItem | a row of its List | `icon` -> its short text; `highlight` dropped |
| sap.m.CustomListItem | a row of its List with its content | - |
| sap.m.Tree | a List, the tree flattened depth first (two spaces per level) | every node is shown expanded; `toggleOpenState` not raised |
| sap.m.StandardTreeItem | a row of its Tree | - |

### Dialogs & popups

| Control | Terminal | Notes |
|---|---|---|
| sap.m.Dialog | an overlay frame titled by `title` above the page, its buttons in the bottom line | modal: only its widgets take the focus while it is open; Esc does not close it (the app decides); `afterClose` not raised |
| sap.m.Popover | an overlay frame (as Dialog) | no anchor; not modal - the page stays focusable, Esc or an action of the page closes it (as UI5 does on a press outside); `afterClose` not raised |

### Messages

| Control | Terminal | Notes |
|---|---|---|
| sap.m.MessageStrip | a banner `Error: text` colored by `type` (Error red, Warning yellow, Success green, Information blue) | `showCloseButton`/`close` dropped; formatted text shown as text |

### Tolerated (no visual)

| Control | Terminal | Notes |
|---|---|---|
| sap.ui.core.CustomData | (nothing) | tolerated, no UI |
| sap.m.FlexItemData | (nothing) | tolerated, no UI |
| sap.ui.layout.GridData | (nothing) | tolerated, no UI |
| sap.m.OverflowToolbarLayoutData | (nothing) | tolerated, no UI |

<!-- terminal:mapping:end -->
