# Conformance apps

The backend suite drives a backend through these apps. A backend that wants
to be tested **serves all of them under exactly these class names** (the
CLI's `--app KEY=CLASS` maps a name when a backend cannot use it). Their
behaviour is specified here, observable on the wire only: the view XML each
app displays is the UI5 profile's (the suite reads it only in `ui5`-profile
checks), the **model** and the sections of the response - `VIEWS`, `NAV`,
`ACTIONS` ([../../spec/response.md](../../spec/response.md#sections)) - are
what the core checks compare.

Reference implementations - behaving identically, byte for byte on the wire
(`test/traffic.test.mjs` compares the recorded traffic):

- [`abap/`](abap/) - ABAP classes in abapGit format (`.clas.abap` +
  `.clas.xml`), built with `z2ui5_cl_ui5_view_builder`, abaplint-clean
  against abap2UI5 with its shared app rule set
  ([`abaplint.jsonc`](abaplint.jsonc), `npm run lint:abap`) and clean in the
  abap2UI5 linter. Pull them into any abap2UI5 system with abapGit, or
  transpile them for `@abap2ui5/node-runtime`
  ([`../hosts/node-runtime/build.mjs`](../hosts/node-runtime/build.mjs)).
- [`cap2ui5/`](cap2ui5/) - the same apps as cap2UI5 JavaScript apps
  (`defineApp`, [`../hosts/cap2ui5/`](../hosts/cap2ui5/package.json)).

Conventions for every app:

- The app displays its MAIN view (a `sap.m.Page`) on every roundtrip on
  which `check_on_navigated( )` is true, and only then (and on `RERENDER`).
- Model names below are the JSON keys (upper case); in the app they are
  lower-case attributes.
- "Pushes the model" means: the response carries `MODEL`, no display.
  "No MODEL" means the key is absent.
- A "display" is an entry `{ "XML", "OPT"? }` of `VIEWS` under its slot, a
  "teardown" the entry `{ "DESTROY": true }`; a follow-up action is an
  entry of `ACTIONS`.
- An event not listed is ignored (nothing changes: no MODEL, none of the
  sections).
- Every app start, and every response of another app than the request
  continued, carries the teardown of POPUP and POPOVER - the backend's
  rule, not the app's
  ([../../spec/response.md](../../spec/response.md#view-slots)).

## Z2UI5_CL_CONF_ECHO

Event roundtrips and their arguments.

| | |
|---|---|
| Model | `COUNT` (integer, 0), `LAST_EVENT` (string, ""), `LAST_ARGS` (string, "") |
| View wires | `ECHO` with the arguments `'alpha'`, `'beta'`; `NOOP`; `PUSH`; `RERENDER`; `LIVE` with the flags queue-last and no-busy (`_event( s_ctrl )` with `check_queue_last` and `check_no_busy` - `.eB(['LIVE',{queueLast:true,noBusy:true}])`) |
| `ECHO` | `COUNT` + 1; `LAST_EVENT` = the event name; `LAST_ARGS` = the event's arguments as the app receives them, joined with `\|` |
| `PUSH` | `COUNT` + 100 - pushes the model |
| `RERENDER` | displays MAIN again (MAIN display + MODEL) |
| `NOOP` | nothing - no MODEL, none of the sections |
| `LIVE` | not handled - ignored like every event not listed; the wire is what the suite reads |

## Z2UI5_CL_CONF_BIND

The model delta. `CHECK` writes what the backend holds into `SUMMARY`.

| | |
|---|---|
| Model (initial) | `NAME` "start", `QTY` 1 (integer), `FLAG` false (boolean), `S_ADDR` { `CITY` "Berlin", `ZIP` "10115" }, `T_ITEMS` [{ `ID` 1, `TEXT` "one", `DONE` false }, { 2, "two", false }, { 3, "three", false }], `SUMMARY` "" |
| View | Input `{/NAME}`, StepInput `{/QTY}`, CheckBox `{/FLAG}`, Inputs `{/S_ADDR/CITY}`, `{/S_ADDR/ZIP}`, a Table over `{/T_ITEMS}` with an Input `{TEXT}` and a CheckBox `{DONE}` per row |
| `CHECK` | `SUMMARY` = `NAME;QTY;FLAG;CITY;ZIP;ROWS` with `FLAG` as `X` or empty and `ROWS` = `ID:TEXT:DONE` per row (`DONE` as `X` or empty) joined with `,` - initially `start;1;;Berlin;10115;1:one:,2:two:,3:three:` |
| `ADD_ROW` | appends { `ID` = rows + 1, `TEXT` "new", `DONE` false }, then as `CHECK` |

## Z2UI5_CL_CONF_MSG

Messages.

| | |
|---|---|
| Model | `LAST_ACTION` (string, "") |
| `TOAST` | `["MESSAGE_TOAST", "show", "conformance toast"]` |
| `BOX` | `["MESSAGE_BOX", "error", "conformance box"]` |
| `BOX_CONFIRM` | `["MESSAGE_BOX", "confirm", "conformance confirm", { "actions": ["OK", "CANCEL"], "onClose": "BOX_CLOSED" }]` |
| `BOX_CLOSED` | `LAST_ACTION` = the first event argument (the pressed action) |

## Z2UI5_CL_CONF_SLOTS

The slots besides MAIN.

| | |
|---|---|
| Model | `POPUP_TEXT` (string, "") - bound in the popup |
| View | Buttons `btn_popup`, `btn_popover` (ids), `Nest`, `Nest2`; VBoxes `nest_anchor`, `nest2_anchor` |
| `POPUP_OPEN` | POPUP display: a `Dialog` titled "conformance popup" with an Input `{/POPUP_TEXT}`, a button wired to `POPUP_CLOSE` and one with the frontend close (`cs_event-popup_close`) |
| `POPUP_REPLACE` | displays the popup twice in one roundtrip ("first", then "second") - one POPUP display, "second" |
| `POPUP_CLOSE` | POPUP teardown: `VIEWS` = `{ "POPUP": { "DESTROY": true } }` |
| `MAIN_AND_POPUP` | calls `popup_display` ("with main") and then `view_display` - a MAIN display and a POPUP display, each under its slot |
| `POPOVER_OPEN` | POPOVER display: a `Popover` titled "conformance popover", `OPT` `{ "openById": "btn_popover" }` |
| `POPOVER_CLOSE` | POPOVER teardown: `VIEWS` = `{ "POPOVER": { "DESTROY": true } }` |
| `NEST_OPEN` / `NEST2_OPEN` | NEST / NEST2 display: a view with a VBox, text "conformance NEST" / "conformance NEST2", `OPT` `{ "id": "nest_anchor" \| "nest2_anchor", "methodInsert": "addItem", "methodDestroy": "removeAllItems" }` |
| `NEST_CLOSE` / `NEST2_CLOSE` | NEST / NEST2 teardown |

## Z2UI5_CL_CONF_NAV and Z2UI5_CL_CONF_NAV_TGT

The app stack.

| | |
|---|---|
| NAV model | `RESULT` (string, ""), `RETURNS` (integer, 0) |
| NAV `CALL` | `nav_app_call` of a new `Z2UI5_CL_CONF_NAV_TGT` with `INPUT` = "from caller" |
| NAV on a navigated roundtrip with the event `RETURNED` | `RESULT` = the target's `OUTPUT` (read from `get_app_prev( )`), `RETURNS` + 1, then display |
| NAV_TGT model | `INPUT` (string), `OUTPUT` (string, "") - `HAS_PREV` is an attribute it does not bind |
| NAV_TGT view | a Page with `showNavButton` = whether there is an app to go back to, `navButtonPress` = the leave wire (`_event_nav_app_leave( )`) |
| NAV_TGT `DONE` | `OUTPUT` = `INPUT` + "!", `nav_app_leave( event = 'RETURNED' )` |

## Z2UI5_CL_CONF_ROUTE

Hash routing.

| | |
|---|---|
| Model | `COUNT` (integer, 0) |
| first roundtrip | `follow_up_action( cs_event-hash_routing )` with `KEEP` - `NAV` = `{ "setNavRouting": "KEEP" }` |
| `COUNT` | `COUNT` + 1 |
| `CALL` | `nav_app_call` of a new `Z2UI5_CL_CONF_NAV_TGT` with `INPUT` = "from route" |

## Z2UI5_CL_CONF_ERROR

The error response.

| | |
|---|---|
| Model | `COUNT` (integer, 0) |
| `FAIL` | `COUNT` + 1, then an unhandled exception (ABAP: a failing conversion, `CX_SY_CONVERSION_NO_NUMBER`; JavaScript: `throw new Error("CONFORMANCE_FAILURE")`) |
| `COUNT` | `COUNT` + 1 |

## Z2UI5_CL_CONF_ACTIONS

Follow-up actions, and the timer the app declares instead of sending it
([../../spec/actions.md](../../spec/actions.md#a-timer-the-backend-keeps)).
What the backend sends for the declared timer is the backend's, not the
app's: the column says what abap2UI5 sends; a backend that keeps no
timer sends nothing there, and the MAY checks skip.

| | |
|---|---|
| Model | `TICKS` (integer, 0), bound to an Input with id `inp` - `ARM` is an attribute it does not bind |
| View | buttons for the events below but `TICK`, and two with a wired frontend action (`follow_up_action( )` as attribute): "Title here" - `SET_TITLE` "wired title", `.eF('SET_TITLE', 'wired title')`; "Stop here" - `cs_event-stop_timer`, `.eF('STOP_TIMER')` |
| `FOCUS` | `["SET_FOCUS", "inp"]` |
| `SEVERAL` | `["SET_TITLE", "conformance title"]`, `["MESSAGE_TOAST", "show", "between"]`, `["SET_FOCUS", "inp"]` - in this order |
| `TIMER` | `["START_TIMER", "TICK", "500"]` |
| `TIMER_REPEAT` | `["START_TIMER", "TICK", "500", "", "X"]` - the repeating timer, the empty no-busy flag in its place |
| `TIMER_STOP` | `["STOP_TIMER"]` (`cs_event-stop_timer`) |
| `TICK` | `TICKS` + 1 |
| `TIMER_SET` | declares the timer: `timer_set( event = 'TICK' delay_ms = 500 )` - abap2UI5 sends `["START_TIMER", "TICK", "500", "", "X"]`, and again whenever the app gets the screen back (a request without a draft id, the return from an app it called) |
| `TIMER_UNSET` | ends the declaration: `timer_stop( )` - abap2UI5 sends `["STOP_TIMER"]` when it had sent the timer |
| `CALL` | `nav_app_call` of a new `Z2UI5_CL_CONF_NAV_TGT` with `INPUT` = "from actions" (its `DONE` returns here) - with a declared timer abap2UI5 puts `["STOP_TIMER"]` first in the target's response |
| `CALL_SELF` | `nav_app_call` of a new `Z2UI5_CL_CONF_ACTIONS` with `ARM` set: on its first display it queues `["START_TIMER", "TICK", "1000", "", "X"]` and clears `ARM` - with a declared timer abap2UI5 puts `["STOP_TIMER"]` before it |

## Z2UI5_CL_CONF_WINDOW

A windowed table the app loads itself
([../../spec/windowed-tables.md](../../spec/windowed-tables.md)). The
list binding's window requests (`___ZZZ_WIN`) reach the app as its event
`ROWS`, with the request in `get( )-r_event_data`; the app sorts, filters
and counts its rows itself. `LAST` and `REQUEST` show what it was handed.

| | |
|---|---|
| Rows | twelve rows `{ ID, NAME, QTY, DONE }` in a table of the app's own (not bound): `ID` 1 to 12, `NAME` "item 01" to "item 12", `QTY` = `ID` * 5 mod 13 (5 10 2 7 12 4 9 1 6 11 3 8), `DONE` false |
| Model (initial) | `T_ROWS` - the rows loaded, the first four in the order of `ID`, bound with ``window_bind_tab( val = t_rows total = total event = `ROWS` window = 4 )``, so `__WINDOW` = { `T_ROWS`: { `TOTAL` 12, `COUNT` 4, `SIZE` 4, `EVENT` "ROWS" } }; `SUMMARY` "", `MAINS` (integer), `LAST` "", `REQUEST` "" (all Text bindings) |
| every roundtrip that runs the app | `MAINS` + 1 first - 1 after the start |
| `MR_WIN` | a second windowed table, behind a data reference (`TYPE REF TO data`, bound dereferenced, so the model node is `/MR_WIN/*`): six rows `{ ID, QTY, DONE }` in a fixed order, `QTY` = `ID` * 5 mod 7 (5 3 1 6 4 2), ordered by `QTY` descending (the `ID` 4 1 5 2 6 3); the first four loaded, ``window_bind_tab( val = <win> total = win_total event = `WIN` window = 4 )``, so `__WINDOW` = { `MR_WIN`: { `*`: { `TOTAL` 6, `COUNT` 4, `SIZE` 4, `EVENT` "WIN" } } }; `WIN_DONE` "" |
| every event | `LAST` = the event and its arguments (`get( )-t_event_arg`), joined with blanks - `ROWS MORE 4 4` |
| View | Texts `{/SUMMARY}`, `{/MAINS}`, `{/LAST}`, `{/REQUEST}`, `{/WIN_DONE}`; the buttons below; a growing `Table` with the id `rows` (`growingThreshold` 4) over `{/T_ROWS}` with `{ID}`, `{NAME}`, `{QTY}` and a CheckBox `{DONE}` per row; a growing `Table` `win` (`growingThreshold` 4) over `{/MR_WIN/*}` with `{ID}`, `{QTY}` and a CheckBox `{DONE}` |
| `ROWS` | the window event. `REQUEST` = the request of `r_event_data`: `path reason skip top`, then ` S:<PATH>:<A or D>` per sorter and ` F<group>:<PATH>:<operator>:<value1>:<value2>` per condition (`/T_ROWS SORT 0 4 S:QTY:D`). For any other `path` nothing else happens. Otherwise the `DONE` of the rows held is written back into the app's rows, then: `MORE` keeps the first `skip` rows (at most the ones held) and appends the next `top` rows of the current order; `SORT` and `FILTER` make the request's sorters and filter the current order and load its first `top` rows. `total` = the rows the filter lets through |
| the app's order | sorters by `ID`, `QTY` (numbers) and `NAME`, the first that tells two rows apart decides, stable; other columns tell nothing apart. Conditions on `NAME` (`Contains`, `EQ`, without regard to case) and on `ID` and `QTY` (`EQ`, `GT`, `LT`, `BT`), a value that is no plain number read as 0; any other condition lets no row through. Groups ANDed, the conditions of a group ORed |
| `WIN` | the window event of `MR_WIN`: `REQUEST` as for `ROWS`; the `DONE` of the rows held written back, then `MORE` keeps the first `skip` rows and appends the next `top` of the fixed order, `SORT` and `FILTER` load its first `top` rows (the sorters and the filter are not applied) |
| `CHECK` | `SUMMARY` = the `ID` of the rows of `T_ROWS` that are `DONE`, in the order of the table, joined with `,`; `WIN_DONE` the same for `MR_WIN` |
| `TOTAL` | `total` = argument 1 (no rows loaded, no view) - not wired, the suite sends it |
| Buttons `Sort list`, `Filter list` | wired frontend actions, no roundtrip of their own: `BINDING_CALL` `rows` `items` `sort` `QTY` `X`, and `rows` `items` `filter` `NAME` `Contains` `1` - the list binding of the UI5 frontend turns each into a window request |

The cap2UI5 twin is written in the same shape. `@cap2ui5/cds-plugin`
0.8.0 hosts the runtime 1.151.0, whose `window_bind_tab( )` takes `total`
and `event`, and passes every window check; 0.7.0 hosted the runtime
1.149.0, which has neither, and the app did not start there
([../RESULTS.md](../RESULTS.md#windowed-tables)).

## Z2UI5_CL_CONF_REF

A table behind a data reference ([../../spec/request.md](../../spec/request.md#the-model-delta)).
An attribute `TYPE REF TO data`, bound dereferenced - in ABAP
`_bind( <tab> )` of the data `mr_tab->*` points to, in cap2UI5 a
`t.ref( )` field bound as `"mr_tab->*"` - so the table is the model node
`/MR_TAB/*`. The windowed table behind a reference is `MR_WIN` of the app
[WINDOW](#z2ui5_cl_conf_window) (it was this app's until the app-driven
window, whose `window_bind_tab( )` the released runtimes do not compile -
REF stays buildable on every runtime).

| | |
|---|---|
| Model (initial) | `MR_TAB` { `*`: [{ `ID` 1, `TEXT` "one", `DONE` false }, { 2, "two", false }, { 3, "three", false }] } (bound with `_bind( )`); `SUMMARY` "" |
| View | Text `{/SUMMARY}`, a button `CHECK`; a Table over `{/MR_TAB/*}` with `{ID}`, an Input `{TEXT}` and a CheckBox `{DONE}` per row |
| `CHECK` | `SUMMARY` = the rows of `MR_TAB` as `ID:TEXT:DONE` (`DONE` as `X` or empty) joined with `,` - initially `1:one:,2:two:,3:three:` |
