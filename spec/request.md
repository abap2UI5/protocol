# Request body

Schema: [../schema/request.schema.json](../schema/request.schema.json).

## Shape

```json
{ "value": {
    "S_FRONT": { "ID": "9EA726DF4B7244BC882F1552C9DE9D97", "EVENT": "SAVE",
                 "T_EVENT_ARG": ["alpha", 2], "HASH": "#/app/ZCL_X/9EA7...",
                 "MS_CLIENT_PREV": 312,
                 "CONFIG": { "S_DEVICE": { "ORIENTATION": "landscape", "RESIZE": { "WIDTH": 1280, "HEIGHT": 800 } } } },
    "MODEL": { "NAME": "Ada", "T_ITEMS": { "__delta": { "1": { "TEXT": "zwei" } } } }
} }
```

The envelope `value` is described in
[transport.md](transport.md#the-envelope). Inside it:

- `S_FRONT` - what the request is (which draft, which event) and what the
  browser says about itself. A frontend MUST send it, except for the bare
  probes of [transport.md](transport.md#bodies-a-backend-must-tolerate).
- `MODEL` - the model delta ([below](#the-model-delta)); absent when the
  user changed nothing.

A frontend SHOULD leave out every key whose value is empty: the UI5
frontend removes an empty `T_EVENT_ARG`, `SEARCH`, `HASH` and `MODEL`, and
the whole `CONFIG` when all of its blocks are empty ([SRV] `roundtrip`). A
backend MUST treat an absent key like an empty one ([H]
`request_parse_body` reads each field with a keyed lookup and leaves a
missing one initial).

## S_FRONT

| Key | Type | When the UI5 frontend sends it | Backend use |
|---|---|---|---|
| `ID` | string | every request that continues a draft: the `S_FRONT.ID` of the last response adopted ([V1] `eB`) | the draft to restore ([sessions.md](sessions.md)) |
| `EVENT` | string | every event request: the first element of the wire's event array ([SRV] `roundtrip`) | what `check_on_event( )` / `get_event( )` answer |
| `T_EVENT_ARG` | array | when the wire carries arguments | [event arguments](#event-arguments) |
| `HASH` | string | every request when the hash is not empty, except in an embedded component whose host keeps the URL ([SRV] `roundtrip`, `state.ownsHash`) | routes and the app-state hash ([navigation.md](navigation.md)) |
| `ORIGIN`, `PATHNAME`, `SEARCH` | string | every app-start-shaped request, and the first request of a page load ([SES] `location`) | `?app_start=`, the launchpad flag, URLs the backend composes; stored with the draft ([H] `session_merge`) |
| `MS_CLIENT_PREV` | integer >= 0 | from the second roundtrip on: the previous roundtrip's duration as the browser measured it ([SRV] `readHttp`) | the roundtrip monitor only; an unreadable value is dropped, never the request ([H] `request_parse_body`) |
| `CONFIG` | object | [the session block](#config-the-session-block) | device, UI5 version, focus, scroll, launchpad data |

A frontend MUST NOT send other keys in `S_FRONT`; a backend MUST ignore
keys it does not know.

- `ORIGIN`, `PATHNAME` and `SEARCH` belong to app-start-shaped requests:
  the backend stores them with the draft ([H] `session_merge`), so a
  frontend SHOULD leave them out of event requests once a response was
  adopted ([SES] `location`). *Frontend check:* `request.location-once`.
- `MS_CLIENT_PREV`, when sent, MUST be the measured duration of a roundtrip
  this frontend made - an integer >= 0 - so it is never on the first
  request of a page load ([SRV] `roundtrip` leaves it off until
  `readHttp` measured one). *Frontend check:* `request.client-prev`.
- A frontend that owns the page's URL SHOULD send a non-empty hash as
  `HASH` with every request ([SRV] `roundtrip`): the backend reads routes
  and the app-state hash from it. *Frontend check:* `router.hash-sent`.

**Implementation note.** cap2UI5's own wire tests also send `APP` and an
empty `XX` next to `MODEL` - leftovers of earlier protocol versions that
the backend ignores.

## App-start-shaped requests

A request **without** `ID` (or with an empty one) asks the backend to start
an app. It carries the location (`ORIGIN`, `PATHNAME`, `SEARCH` with
`?app_start=<CLASS>`), the `HASH` when there is one, and the whole session
block ([SES] `config`: a request without draft id always re-sends it,
because the app it starts has no session record to inherit from). Which app
it starts is decided by
[navigation.md](navigation.md#which-app-a-request-starts). The UI5 frontend
sends one on the page load (App controller -> `Server.roundtrip(ctx, {})`)
and on every Back/Forward restore of a route ([SRV] `restoreFromRoute`).

- A frontend that starts a named app MUST name it in the app-start
  request - as `?app_start=<CLASS>` in `SEARCH` ([SES] `location`, [AC]
  `start`) or as a route in `HASH`; a request that names none starts the
  backend's own start app ([navigation.md](navigation.md#which-app-a-request-starts)).
- It SHOULD send `ORIGIN` and `PATHNAME` of the endpoint as the user
  reaches it: the backend builds URLs from them and keeps them with the
  session. A frontend that does not run on that page takes them from its
  embedder (the agent client's `location` option, [AC] `createAppClient`).
- *Frontend checks:* `request.app-start`, `request.app-start-location`.

## Event requests

A request **with** `ID` continues that draft. With `EVENT` set the backend
runs the app with that event ([ACT] `factory_by_frontend`); an event the app
does not handle is answered normally (the app's `main( )` just does
nothing). *Checked by:* `event.roundtrip`, `event.unknown-event`.

- The event name is the one the backend wrote into the view's wire
  ([../profiles/ui5.md](../profiles/ui5.md#event-wires)) or into a follow-up
  action that raises events (`onClose` of a message box, the event of
  `START_TIMER`, [actions.md](actions.md)). A frontend MUST send it
  unchanged, with the `ID` of the response it adopted last
  ([response.md](response.md#s_front)). *Frontend checks:* `request.event`,
  `request.id-continuation`, `request.leave-event`.
- A request with `ID` and without `EVENT` is valid (the app runs with no
  event); the UI5 frontend does not send one.
- **Reserved event names.** `___ZZZ_NAL` is the leave event: the backend
  does not run the app but leaves it ([navigation.md](navigation.md#the-reserved-leave-event)).
  An app MUST NOT use it for anything else. `___ZZZ_WIN` is the window
  request of a windowed table: the backend runs the app with the app's own
  event the request names, the request in `get( )-r_event_data`
  ([windowed-tables.md](windowed-tables.md#the-window-request)).

## Event arguments

`T_EVENT_ARG` holds the arguments of the wire after the event array, as raw
JSON values - the frontend serializes the request once ([V1] `eB`); an
argument that is no plain data is first marshalled to plain data ([LIB]
`normalizeEventArgs`): a control becomes its id and properties, a binding
context `{ "PATH": <model path>, "OBJECT": <the data there> }`, the UI5
event itself (`$event`) `{ "ID", "SOURCE", "PARAMETERS" }`, and a reference
back to one of its own ancestors `null`. A request the frontend cannot
serialize is not sent ([SRV] `readHttp`).

The backend hands every argument to the app as a **string**
([H] `request_parse_event_args`):

| JSON value | The app receives |
|---|---|
| string | the string |
| number | its JSON text (`42`, `1.5`) |
| `true` / `false` | `X` / the empty string (the ABAP boolean) |
| `null` | the empty string |
| object, array | its JSON text, compact (`{"k":"v","n":[1,2]}`) |

- A backend MUST apply this conversion and keep the order; the app reads
  argument *n* as `get_event_arg( n )` (1-based) or the whole list as
  `get( )-t_event_arg` ([IC]). *Checked by:* `event.argument-conversion`,
  `event.no-arguments`.
- A backend SHOULD refuse more than 100 arguments with an error status
  ([H] `c_event_arg_limit` - each object argument costs a parse of its own,
  and 50,000 of them once held a work process for minutes).
- A frontend MUST send every argument as the JSON value the wire resolved
  to - a string as a string (an empty literal `''` as `""`, in its
  place), a number as a number, a boolean as `true` / `false`, an object
  as an object - and MUST NOT apply the conversion above itself ([V1]
  `eB`: "Arguments travel as raw JSON values - the request body is
  serialized exactly once"; [AC] `eventArgs`). The conversion is the
  backend's: an object a frontend stringified would reach the app escaped
  twice, and a backend for apps that are not ABAP may map booleans
  differently ([open-questions.md](open-questions.md#4-boolean-event-arguments-for-backends-that-are-not-abap)).
  A wire without arguments SHOULD send no `T_EVENT_ARG`.
  *Frontend checks:* `request.event-arguments`, `request.event-no-arguments`.
- **Implementation note.** The boolean mapping to `X`/empty is ABAP's; a
  JavaScript app on cap2UI5 sees the same strings ([CAP] `get_event_arg`).

## The model delta

`MODEL` carries what the user changed in the model **of the view the event
was fired from** since the last roundtrip. MAIN, NEST and NEST2 share one
model; POPUP and POPOVER have their own ([V1] `_pickModelForRoundtrip`). Edits
in another slot's model stay pending for an event from that slot.

The frontend builds the delta from the changed binding paths
([LIB] `buildDeltaFromPaths`):

| Changed path | Delta entry |
|---|---|
| `/ATTR` (a scalar, or a structure component `/S_ADDR/CITY`) | `"ATTR": <whole current value of ATTR>` - a structure always travels whole |
| `/T_TAB/<row>/<FIELD>` (a table cell) | `"T_TAB": { "__delta": { "<row>": { "<FIELD>": <value> } } }`, `<row>` 0-based |
| `/T_TAB/<row>/<SUB>/<row2>/<FIELD>` (a nested table) | the same, recursively: `{ "__delta": { "<row>": { "<SUB>": { "__delta": { "<row2>": { ... } } } } } }` |
| `/T_TAB/<row>/<S>/<F>` (a structure inside a row) | `"<S>": <whole value>` inside the row entry |
| `/MR_TAB/*/<row>/<FIELD>` (a cell of a table behind a data reference - an attribute `TYPE REF TO data`, bound dereferenced, is the model node `/MR_TAB/*`) | the same on the `*` node: `"MR_TAB": { "*": { "__delta": { "<row>": { "<FIELD>": <value> } } } }`, nested tables recursively |
| any other shape - `/MR_S/*/<F>` (a structure behind a reference) and `/MR_V/*` (a value) included | the whole attribute |

When one attribute is queued both whole and by row, the whole value wins
(it carries every cell) - behind a data reference too: the whole
`"MR_TAB": { "*": [ ... ] }`. A whole table value replaces the table.

Rules for the frontend:

- `MODEL` MUST name only attributes with a path the user edited since the
  last roundtrip of that model - a value the backend pushed is no edit -
  and is absent when nothing was edited ([V1] `eB` builds it from the
  model's `_z2ui5ChangedPaths`, [SRV] `_clearSentPaths` clears what a won
  request carried). An entry for an attribute the user did not touch
  writes the frontend's copy over whatever the app holds.
  *Frontend checks:* `model.only-edited`, `model.none-when-unedited`,
  `model.unchanged-push-no-delta`.
- An edited scalar or structure component MUST travel as the whole current
  value of its top-level attribute. An edited table cell MUST travel as the
  `__delta` above or as the whole current table, and SHOULD travel as the
  `__delta` - a backend applies both, the delta keeps a large table off the
  wire ([LIB] `buildDeltaFromPaths`). The whole value MUST win over a delta
  of the same attribute. *Frontend checks:* `model.scalar`,
  `model.number-and-boolean`, `model.structure-whole`, `model.table-cell`,
  `model.table-row-delta`, `model.nested-table`, `model.whole-beats-delta`.
  A cell of a [windowed table](windowed-tables.md#edits) travels the same
  way - the table is what the frontend shows - and never with the
  `__WINDOW` key. *Frontend check:* `window.edit-row-shown`.
- The `__delta` of a table behind a data reference MUST go on its `*`
  node - the attribute's client name is `/<attr>/*`, and that is where the
  backend looks for `__delta` ([MOD] `main_json_to_attri`; [LIB]
  `buildDeltaFromPaths` from abap2UI5 2cc0344, #3026, on). A frontend that
  sends such a table whole sends the whole attribute,
  `{ "MR_TAB": { "*": [ ... ] } }`. *Frontend check:*
  `window.edit-row-shown-reference`.
- The delta is the edited model's: an event from a popup carries the
  popup's edits, not MAIN's ([V1] `_pickModelForRoundtrip`).
  *Frontend check:* `model.slot-model`.

The backend applies the delta **before** the app runs ([ACT]
`factory_by_frontend`, [MOD] `main_json_to_attri`):

- A backend MUST apply a delta entry only to an attribute the app has bound
  (`_bind( )`); an entry for anything else MUST be ignored without error.
  *Checked by:* `model.unknown-attribute-ignored`.
- A scalar replaces the attribute, converted to its type (numbers,
  booleans, strings; dates and times travel as strings). A structure or a
  table given whole replaces the attribute. *Checked by:* `model.scalar`,
  `model.number-and-boolean`, `model.structure`, `model.table-whole`.
- A `__delta` entry changes exactly the named cells of the named rows.
  *Checked by:* `model.table-row-delta`, `model.combined-delta`.
- An attribute the delta does not name keeps its server value. *Checked
  by:* `model.absent-attributes-kept`.
- A row key that is not a non-negative integer, or names a row that does
  not exist, SHOULD be ignored ([MOD] `delta_row_index`). *Checked by:*
  `model.row-out-of-range-ignored`.
- A value the backend cannot write - a cell or a whole scalar that does
  not convert into its type, a row delta on a sorted or hashed table -
  SHOULD be ignored and reported to the app (the reference lists it in
  `get( )-t_model_skipped`, [MOD] `delta_trace_skipped`,
  `whole_value_trace`), never fail the roundtrip: the attribute keeps its
  value and the rest of the delta is applied. *Checked by:*
  `model.unconvertible-scalar-skipped`.
- A **windowed table** is no exception: the row keys of a `__delta` are
  rows of the table, and a whole table value is written
  ([windowed-tables.md](windowed-tables.md#edits)). *Checked by:*
  `window.delta-rows`, `window.whole-table-written`.
- **Implementation note.** An attribute bound with `_bind( json = abap_true )`
  is outbound only; a delta for it is skipped ([MOD] `main_json_to_attri`).
- A table behind a data reference - an attribute `TYPE REF TO data`,
  bound dereferenced - is the model node `/<attr>/*`, and a backend MUST
  read its entry there: a `__delta` on the `*` node changes exactly the
  named cells, as on any table, a windowed one included
  ([MOD] `main_json_to_attri` reads every entry at the attribute's client
  name, `/MR_TAB/*`). A backend that looks for the `__delta` at `/<attr>`
  only drops every edit of such a table without an error
  ([open-questions.md](open-questions.md#14-tables-behind-a-data-reference-in-the-backend-suite)).
  *Checked by:* `model.reference-delta`,
  `window.delta-rows-reference`.
- A whole value at `/MR_TAB/*` replaces the table behind the reference,
  a windowed one included ([MOD] `main_json_to_attri`).

## CONFIG: the session block

What the browser says about itself. The backend stores it with the draft
([H] `session_merge`), so most requests do not repeat it ([SES]):

| Block | Content | Cadence (UI5 frontend) |
|---|---|---|
| `S_UI5` | `VERSION`, `BUILDTIMESTAMP`, `GAV`, `THEME` of the UI5 runtime | on every app-start-shaped request once it is loaded; when the page load's first request went out before it was loaded, alone with the first later request that finds it there ([SES] `config`, the `ui5Sent` latch) |
| `S_DEVICE` | `SYSTEM` (phone/tablet/desktop/combi), `BROWSER` and `OS` `{NAME, VERSION}`, `SUPPORT` `{TOUCH, POINTER, RETINA}` - static; `ORIENTATION`, `RESIZE {WIDTH, HEIGHT}` - live | static fields with the session block; the two live fields whenever they changed since the last confirmed send |
| `S_FOCUS` | `ID` of the focused control, `SELECTION_START`, `SELECTION_END` | every request with a focused control ([SF]) |
| `S_SCROLL` | per slot (`MAIN` ... `POPOVER`) the scrolled control: `ID`, `X`, `Y` | every request with a scroll position ([SF]) |
| `ComponentData` | the launchpad's component data (`startupParameters`, ...) | with the session block, inside a launchpad |

- A frontend MAY send no `CONFIG` at all; the backend then answers
  `get( )` with empty device data. The agent client and the backend suite
  send none.
- A backend MUST treat an absent block, and an absent live field, as
  "unchanged": a block carried by the request replaces the stored one, a
  live field overwrites only that field ([H] `session_merge`). The device
  profile is the unit: a request that carries `S_DEVICE.SYSTEM` replaces
  the stored `S_DEVICE` and `S_UI5` together, a request that carries
  `S_UI5` without it replaces `S_UI5` alone and leaves the stored device
  profile as it is ([H] `session_merge`).
- The numbers of the block only inform the app - the window size, the
  caret positions, the scroll offsets. One the backend cannot hold (not a
  number, outside its integer range) is read as absent and never fails the
  request, like `MS_CLIENT_PREV` ([H] `request_get_int`).
- **Implementation note.** Up to abap2UI5 1.146.0 the UI5 frontend repeated
  the whole static block with every request until `S_UI5` had gone out,
  and a request carrying `S_UI5` without the device profile replaced the
  stored profile by an empty one. The reference maps `S_DEVICE.OS.NAME`
  onto the lower-case names its client API documents (`iOS` -> `ios`,
  `Android` -> `android`; [H] `device_os_name`) - what an app reads, not
  what travels.
- The latches of the UI5 frontend advance only once the carrying request
  won (its response was adopted) - a dropped request re-sends ([SES]
  `confirmSent`).
- A frontend that sends the session block SHOULD send it whole with
  app-start-shaped requests and leave the static parts (`S_UI5`, the static
  `S_DEVICE` fields, `ComponentData`) out of event requests once the backend
  has them ([SES] `config`) - a part that goes out late for the first time
  is no repeat. *Frontend check:* `request.config-cadence`.
