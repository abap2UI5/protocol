# Conformance apps

The backend suite drives a backend through these apps. A backend that wants
to be tested **serves all of them under exactly these class names** (the
CLI's `--app KEY=CLASS` maps a name when a backend cannot use it). Their
behaviour is specified here, observable on the wire only: the view XML each
app displays is the UI5 profile's (the suite reads it only in `ui5`-profile
checks), the **model** and the **actions** are what the core checks compare.

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
- An event not listed is ignored (nothing changes, no MODEL, no action).

## Z2UI5_CL_CONF_ECHO

Event roundtrips and their arguments.

| | |
|---|---|
| Model | `COUNT` (integer, 0), `LAST_EVENT` (string, ""), `LAST_ARGS` (string, "") |
| View wires | `ECHO` with the arguments `'alpha'`, `'beta'`; `NOOP`; `PUSH`; `RERENDER` |
| `ECHO` | `COUNT` + 1; `LAST_EVENT` = the event name; `LAST_ARGS` = the event's arguments as the app receives them, joined with `\|` |
| `PUSH` | `COUNT` + 100 - pushes the model |
| `RERENDER` | displays MAIN again (MAIN display + MODEL) |
| `NOOP` | nothing - no MODEL, no action |

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
| `POPUP_CLOSE` | `["VIEW_SLOTS", "destroy", "POPUP"]` |
| `MAIN_AND_POPUP` | calls `popup_display` ("with main") and then `view_display` - displays MAIN, then POPUP |
| `POPOVER_OPEN` | POPOVER display: a `Popover` titled "conformance popover", options `{ "openById": "btn_popover" }` |
| `POPOVER_CLOSE` | `["VIEW_SLOTS", "destroy", "POPOVER"]` |
| `NEST_OPEN` / `NEST2_OPEN` | NEST / NEST2 display: a view with a VBox, text "conformance NEST" / "conformance NEST2", options `{ "id": "nest_anchor" \| "nest2_anchor", "methodInsert": "addItem", "methodDestroy": "removeAllItems" }` |
| `NEST_CLOSE` / `NEST2_CLOSE` | destroy NEST / NEST2 |

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
| first roundtrip | `follow_up_action( cs_event-hash_routing )` with `KEEP` |
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

Follow-up actions.

| | |
|---|---|
| Model | `TICKS` (integer, 0), bound to an Input with id `inp` |
| View | also a button with the wired frontend action `SET_TITLE` "wired title" (`follow_up_action( )` as attribute) |
| `FOCUS` | `["SET_FOCUS", "inp"]` |
| `SEVERAL` | `["SET_TITLE", "conformance title"]`, `["MESSAGE_TOAST", "show", "between"]`, `["SET_FOCUS", "inp"]` - in this order |
| `TIMER` | `["START_TIMER", "TICK", "500"]` |
| `TICK` | `TICKS` + 1 |
