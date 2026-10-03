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
| `HASH` | string | every request when the hash is not empty, except in an embedded component ([SRV] `roundtrip`) | routes and the app-state hash ([navigation.md](navigation.md)) |
| `ORIGIN`, `PATHNAME`, `SEARCH` | string | every app-start-shaped request, and the first request of a page load ([SES] `location`) | `?app_start=`, the launchpad flag, URLs the backend composes; stored with the draft ([H] `session_merge`) |
| `MS_CLIENT_PREV` | integer >= 0 | from the second roundtrip on: the previous roundtrip's duration as the browser measured it ([SRV] `readHttp`) | the roundtrip monitor only; an unreadable value is dropped, never the request ([H] `request_parse_body`) |
| `CONFIG` | object | [the session block](#config-the-session-block) | device, UI5 version, focus, scroll, launchpad data |

A frontend MUST NOT send other keys in `S_FRONT`; a backend MUST ignore
keys it does not know.

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

## Event requests

A request **with** `ID` continues that draft. With `EVENT` set the backend
runs the app with that event ([ACT] `factory_by_frontend`); an event the app
does not handle is answered normally (the app's `main( )` just does
nothing). *Checked by:* `event.roundtrip`, `event.unknown-event`.

- The event name is the one the backend wrote into the view's wire
  ([../profiles/ui5.md](../profiles/ui5.md#event-wires)) or into a follow-up
  action that raises events (`onClose` of a message box, the event of
  `START_TIMER`, [actions.md](actions.md)). A frontend MUST send it
  unchanged.
- A request with `ID` and without `EVENT` is valid (the app runs with no
  event); the UI5 frontend does not send one.
- **Reserved event names.** `___ZZZ_NAL` is the leave event: the backend
  does not run the app but leaves it ([navigation.md](navigation.md#the-reserved-leave-event)).
  An app MUST NOT use it for anything else.

## Event arguments

`T_EVENT_ARG` holds the arguments of the wire after the event array, as raw
JSON values - the frontend serializes the request once ([V1] `eB`); a
control-valued argument is first marshalled to plain data ([LIB]
`normalizeEventArgs`).

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
| any other shape | the whole attribute |

When one attribute is queued both whole and by row, the whole value wins
(it carries every cell). A whole table value replaces the table.

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
- A cell the backend cannot write - a value that does not convert, a row
  delta on a sorted or hashed table - SHOULD be ignored and reported to the
  app (the reference lists it in `get( )-t_model_skipped`, [MOD]
  `delta_trace_skipped`), never fail the roundtrip.
- **Implementation note.** An attribute bound with `_bind( json = abap_true )`
  is outbound only; a delta for it is skipped ([MOD] `main_json_to_attri`).

## CONFIG: the session block

What the browser says about itself. The backend stores it with the draft
([H] `session_merge`), so most requests do not repeat it ([SES]):

| Block | Content | Cadence (UI5 frontend) |
|---|---|---|
| `S_UI5` | `VERSION`, `BUILDTIMESTAMP`, `GAV`, `THEME` of the UI5 runtime | until the block has gone out complete once per page load; on every app-start-shaped request |
| `S_DEVICE` | `SYSTEM` (phone/tablet/desktop/combi), `BROWSER` and `OS` `{NAME, VERSION}`, `SUPPORT` `{TOUCH, POINTER, RETINA}` - static; `ORIENTATION`, `RESIZE {WIDTH, HEIGHT}` - live | static fields with the session block; the two live fields whenever they changed since the last confirmed send |
| `S_FOCUS` | `ID` of the focused control, `SELECTION_START`, `SELECTION_END` | every request with a focused control ([SF]) |
| `S_SCROLL` | per slot (`MAIN` ... `POPOVER`) the scrolled control: `ID`, `X`, `Y` | every request with a scroll position ([SF]) |
| `ComponentData` | the launchpad's component data (`startupParameters`, ...) | with the session block, inside a launchpad |

- A frontend MAY send no `CONFIG` at all; the backend then answers
  `get( )` with empty device data. The agent client and the backend suite
  send none.
- A backend MUST treat an absent block, and an absent live field, as
  "unchanged": a block carried by the request replaces the stored one, a
  live field overwrites only that field ([H] `session_merge`).
- The latches of the UI5 frontend advance only once the carrying request
  won (its response was adopted) - a dropped request re-sends ([SES]
  `confirmSent`).
