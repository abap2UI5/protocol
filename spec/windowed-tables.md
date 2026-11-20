# Windowed tables

A **windowed table** is a table the **app** loads a window at a time: the
model carries the rows the app has loaded so far, a state next to them says
how many there are in all, and the frontend's list asks the app for more
rows as it grows or scrolls, and for the first rows of a new order when it
is sorted or filtered. The app loads, sorts, filters and counts the rows
itself - the way an OData service answers `$skip`, `$top`, `$orderby` and
`$filter`; the backend neither sorts nor filters nor keeps an order. An app
asks for one with ``window_bind_tab( val = t_rows total = total event =
`ROWS` window = 4 )`` instead of `_bind( )` ([IC] `window_bind_tab`).

This is the windowed table of abap2UI5 after 1.149.0 (branch DEV,
`186f2c9b`), which replaced the one the release 1.149.0 shipped - a window
the backend cut from the whole table, sorted and filtered itself and kept
with the draft - a few days after it was released. The two wires do not
understand each other; why the protocol number stays 2 regardless is
[open question 14](open-questions.md#14-the-app-driven-window-and-the-protocol-number).

Three things travel for it, all inside the messages of
[request.md](request.md) and [response.md](response.md):

- the **window state** `/__WINDOW/<path>` in `MODEL`, next to the rows;
- the **window request**, an event request with the reserved event
  `___ZZZ_WIN`, which the backend turns into the app's own event;
- **edits**, which are edits of the table like any other: the table is
  what the frontend shows.

Nothing in the view marks the table: a windowed table is bound like any
other (`items="{/T_ROWS}"`, recorded in
[`traffic/node-runtime/suite.json`](../traffic/node-runtime/suite.json),
check `window.first-window`). A table is windowed when the model carries a
window state for its path ([WM] `bindList`).

## The window state

```json
{ "S_FRONT": { "ID": "5290E847062342FC9E654EF8A355FCF7", "APP": "Z2UI5_CL_CONF_WINDOW", "PROTOCOL": 2 },
  "MODEL": {
    "T_ROWS": [ { "ID": 1, "NAME": "item 01", "QTY": 5, "DONE": false }, { "ID": 2, "NAME": "item 02", "QTY": 10, "DONE": false },
                { "ID": 3, "NAME": "item 03", "QTY": 2, "DONE": false }, { "ID": 4, "NAME": "item 04", "QTY": 7, "DONE": false } ],
    "__WINDOW": { "T_ROWS": { "TOTAL": 12, "COUNT": 4, "SIZE": 4, "EVENT": "ROWS" } } } }
```

For a windowed table at the model path `/<path>`, `MODEL` carries
([MOD] `window_meta`, [TY] `cv_window_model_key`):

- at `/<path>` the table **as the app holds it** - the rows it loaded, in
  the order it loaded them, serialized like any bound table;
- at `/__WINDOW/<path>` the window state:

| Key | Meaning |
|---|---|
| `TOTAL` | the rows there are in all, as the app reports them - the length of the list; at least `COUNT` |
| `COUNT` | the rows of the table, the ones the model carries at `/<path>` |
| `SIZE` | the rows a frontend asks for at a time, as the app set it (`window`, at least 1) |
| `EVENT` | the app's event a window request of this table names (`event`) |

`TOTAL` is the larger of the app's `total` and `COUNT`. The app passes
`total` like the table, by reference: when it is an attribute of the app,
the backend reads it **anew for every response** ([BND] `window_adopt`
remembers its name, [MOD] `window_meta` reads it), so an event that loads,
sorts or filters only sets it and renders no view; a value that is no
attribute stays the value of the last `window_bind_tab( )`. `SIZE`,
`EVENT` and that `total` follow the latest `window_bind_tab( )` of the
table; a plain `_bind( )` of it leaves them as they are ([BND]
`window_adopt`).

The state mirrors the path: a table in a structure at `/S_DATA/T_ROWS` has
its state at `/__WINDOW/S_DATA/T_ROWS`, a table behind a data reference,
which the model carries at `/MR_TAB/*`, at `/__WINDOW/MR_TAB/*` ([WM]
`windowName`; the release's fixture [WT] binds `mr_tab` and its e2e test
reads `MODEL.__WINDOW.MR_TAB["*"]` - the conformance app has no such
table, so this is not in the recorded traffic).

- A backend MUST send, in every `MODEL` that carries a windowed table, the
  table as the app holds it at the table's path and the window state with
  `TOTAL`, `COUNT`, `SIZE` and `EVENT` under `/__WINDOW/<path>`. `MODEL`
  stays complete ([response.md](response.md#model)): every other bound
  attribute is in it as before. *Checked by:* `window.first-window`.
- `TOTAL` MUST be the app's total as the app holds it when the response is
  made, and never less than `COUNT` ([MOD] `window_meta`: `nmax( total,
  count )`). *Checked by:* `window.total-from-app`.
- `__WINDOW` is a reserved key of the model. An app MUST NOT bind an
  attribute of that name; a view MAY bind the state
  (`{/__WINDOW/T_ROWS/TOTAL}`, [TY] `cv_window_model_key`).
- **Implementation note.** The reference leaves a `TOTAL` or `COUNT` of 0
  out of the JSON, as it leaves out every initial value it writes there -
  an app that loaded no rows sends `{ "SIZE": 4, "EVENT": "ROWS" }`
  (`window.request-bounds`, recorded). A frontend reads a missing one as
  0; `SIZE` is never 0 and always there, so it is what tells a window
  state from a path segment (`schema/response.schema.json`).

## The window request

```json
{ "value": { "S_FRONT": { "ID": "5290E847062342FC9E654EF8A355FCF7", "EVENT": "___ZZZ_WIN",
  "T_EVENT_ARG": ["/T_ROWS", "ROWS", "MORE", "4", "4"] } } }
```

A window request is an [event request](request.md#event-requests) with the
reserved event `___ZZZ_WIN` ([TY] `cs_event_window`, [WM] `EVENT`). It
continues a draft like any event and carries the model delta like any event
([WM] `_z2ui5Send` through the slot's `eB`). Its arguments ([WIN]
`request`, `event`):

| `T_EVENT_ARG` | Meaning |
|---|---|
| `[path, event, "MORE", skip, top]` | more rows: `top` rows after the `skip` rows the frontend holds |
| `[path, event, "SORT", "0", top, sort, filter]` | the list was sorted: the first `top` rows of the new order |
| `[path, event, "FILTER", "0", top, sort, filter]` | the list was filtered: the same |

`path` is the model path of the table with its leading slash (`/T_ROWS`,
`/MR_TAB/*`), `event` the `EVENT` of its window state, the reason one of
[IC] `cs_window_reason`. `skip` and `top` are counts of rows, which the UI5
frontend sends as strings. A `SORT` and a `FILTER` carry **both** parts -
the sorters and the filter groups, as the texts of JSON arrays
([below](#sorters-and-filters)) - so that the app learns the whole state of
the list in one request; `[]` is none. Recorded from the UI5 frontend's own
code in
[`traffic/node-runtime/ui5-frontend.json`](../traffic/node-runtime/ui5-frontend.json)
(the `WINDOW:` exchanges) and in the e2e test of the release [WT].

Rules for the backend ([H] `main_process`, `WHEN cs_event_window`):

- A backend MUST turn a window request into **the app's event**: the event
  the app sees is the second argument, its arguments (`get( )-t_event_arg`)
  are `[reason, skip, top]`, and `get( )-r_event_data` holds the request -
  a reference to [IC] `ty_s_window_request` with `path`, `reason`, `skip`,
  `top`, `t_sort` and `t_filter`. Then it runs the app's `main( )` like for
  any event and answers a normal response: a new draft id
  ([sessions.md](sessions.md#draft-ids)), the same `APP`, and the model as
  the app left it - the rows it loaded and their state. The backend adds
  no view of its own. *Checked by:* `window.app-event`.
- `path` is handed over as it was sent: which table asks is the app's to
  read, when several tables share one event. The backend does not check it
  against the app's windowed tables. *Checked by:* `window.app-event`.
- A `SORT` or `FILTER` request hands the app the parsed sorters and filter
  groups ([below](#sorters-and-filters)) and `skip` 0, whatever was sent; a
  `MORE` request hands it neither part, whatever was sent ([WIN]
  `request`). *Checked by:* `window.request-sort-filter`.
- A request the backend cannot read whole SHOULD still be the app's event,
  never fail ([WIN] `request`, `count_of`): the reason is read without
  regard to case and blanks, and one that is neither `SORT` nor `FILTER` is
  `MORE`; a count that is no plain number of at most nine digits is 0; a
  missing argument is empty. *Checked by:* `window.request-bounds`.
- `___ZZZ_WIN` is a reserved event name
  ([request.md](request.md#event-requests)). An app MUST NOT use it; the
  event it names in `window_bind_tab( )` is one of its own.
- **Implementation note.** A request without an event - fewer than two
  arguments, or an empty second one - runs the app with an empty event and
  the arguments `[MORE, 0, 0]`; no frontend sends one
  ([below](#frontends)). A request in the shape of 1.149.0, `[path,
  count]`, reaches the app as an event named after the count
  (`traffic/node-runtime/agent-client.json`).

## Sorters and filters

The two parts of a `SORT` and a `FILTER` are JSON **texts** - strings in
`T_EVENT_ARG`, not JSON values ([WM] `_z2ui5Send` stringifies them):

```
sort    [{ "PATH": "QTY", "DESCENDING": true }, { "PATH": "NAME", "DESCENDING": false }]
filter  [[["QTY", "GT", 8, null]], [["NAME", "Contains", "1", null], ["ID", "EQ", 5, null]]]
```

- **Sorters** ([WIN] `parse_sort`): an array of `{ PATH, DESCENDING }` in
  the order of the list's sorters. The app gets them as [IC]
  `ty_t_bind_tab_sort`: `path` in upper case, `descending` a boolean; a
  sorter without a path is left out.
- **Filter groups** ([WIN] `parse_filter`): an array of groups, each an
  array of conditions `[path, operator, value1, value2]`. The **groups are
  ANDed, the conditions of one group ORed** - the shape UI5 gives the
  filters of a list binding (the conditions on one column ORed, the
  columns ANDed; [WM] `filterGroups`). The app gets them as [IC]
  `ty_t_bind_tab_filter`, one line per condition: `group` the number of
  its group, counted from 1, `path` in upper case, `operator` as sent - a
  `sap.ui.model.FilterOperator` name (`EQ`, `NE`, `LT`, `LE`, `GT`, `GE`,
  `BT`, `NB` with `value2` as the upper bound, `Contains`, `NotContains`,
  `StartsWith`, `NotStartsWith`, `EndsWith`, `NotEndsWith`) - and the
  values as text: a number as its digits, `null` as empty, a date as the
  frontend sent it (`yyyy-MM-dd` from the UI5 frontend, [WM] `wireValue`).
- A backend MUST hand the app the parts in that shape. *Checked by:*
  `window.request-sort-filter` (the app WINDOW writes what it got into
  `REQUEST`: `S:QTY:D` per sorter, `F2:NAME:Contains:1:` per condition).
- **What a sorter or a condition means is the app's.** The backend applies
  neither; the app decides which columns it sorts and filters by, how it
  compares them and what it does with an operator it does not support
  ([IC] `ty_s_bind_tab_filter`: "Applying them is the app's").
- **Implementation note.** A part that is no readable JSON array counts as
  none ([WIN] `parse_sort`, `parse_filter`, "a sort that cannot be read is
  no sort"). *Checked by:* `window.request-bounds`.

## The app owns the order

There is no order on the backend: the table is the rows the app loaded, in
the order it loaded them ([TY] `ty_s_attri`, `window_size`,
`window_total`, `window_event`: "The framework neither sorts nor filters
nor keeps an order"). No response names a sort or a filter, and the
frontend's list keeps its own sorters and filters and sends both with every
`SORT` and `FILTER` ([WM], the header). What the app does with a request is
its own - the conformance app WINDOW, like the release's fixture [WT]:

- for `MORE` it keeps the first `skip` rows and appends the next `top` rows
  of its current order;
- for `SORT` and `FILTER` it takes the request's sorters and filter as the
  order of the list, combines them with an order of its own if it has one,
  and loads the first `top` rows of the result; it sets `total` to the rows
  the filter lets through.

What binds a backend:

- The rows the app loaded and everything it keeps to load more belong to
  the **draft** ([sessions.md](sessions.md#drafts-are-snapshots)): a
  request that continues an earlier draft continues that draft's rows,
  also after later drafts sorted, filtered or edited. *Checked by:*
  `window.order-with-the-draft`.
- **Implementation note - the draft.** abap2UI5 1.149.0 kept a windowed
  table in a frame of its own next to the app's serialization ([TY]
  `ty_s_kept`); that frame is gone with the app-driven window, and a
  windowed table is serialized with the app like every other attribute.
  None of it was on the wire.

## Edits

- The table is what the frontend shows, so an edit of a windowed table is
  an edit of a table like any other
  ([request.md](request.md#the-model-delta)): the row keys of a `__delta`
  are the rows of the table, 0-based, and a backend MUST write the cells
  into those rows ([MOD] `delta_apply_nodes`) - no position is mapped. The
  delta is applied before the app runs, also for a window request, which
  carries it like any event - an edit that travels with a `SORT` is in the
  table when the app's event loads the rows anew. *Checked by:*
  `window.delta-rows`.
- A **whole table value** for a windowed table is written like one for any
  table: the table becomes the rows sent, `COUNT` follows them, `TOTAL`
  stays the app's. *Checked by:* `window.whole-table-written`.
- A frontend MUST send an edit of a windowed table as an edit of the row
  it shows - a `__delta` at its index, or the table whole as
  [request.md](request.md#the-model-delta) allows for any table - and MUST
  NOT send the `__WINDOW` key. *Frontend check:* `window.edit-row-shown`.
- An event that hands over a row of the table (`/T_ROWS/5` of a binding
  context) names the row of the table with that index: the app reads
  `t_rows[ 6 ]` ([IC] `window_bind_tab`: "a row, a cell edit or a
  selection is the row of val with the same index"; `window_get_row( )` of
  1.149.0 is gone).

## Frontends

- Every frontend MUST adopt a `MODEL` that carries `/__WINDOW`: the key is
  no attribute of the app, the rows at a windowed path are the rows to
  show, in the order they came, and a missing `TOTAL` or `COUNT` is 0. A
  frontend SHOULD NOT sort or filter the rows of a windowed table itself -
  they are the app's window of a larger list ([WM] `applySort`,
  `applyFilter` do nothing for a windowed list). *Frontend check:*
  `window.rows-shown`.
- A frontend MAY send window requests. One that does MUST send them as
  [above](#the-window-request), with the `ID` of the response it adopted
  last and the `EVENT` of the table's window state:
  - more rows: `MORE`, `skip` the rows it holds, `top` whole windows -
    the rows it needs rounded up to a multiple of `SIZE`, less the ones it
    holds, at most up to `TOTAL` ([WM] `_z2ui5Ensure`);
  - a new sort or filter: `SORT` or `FILTER`, `skip` 0, `top` one window
    (`SIZE`), and both parts - all the sorters and all the filter groups
    the list holds after the change ([WM] `_z2ui5Restart`, `_z2ui5Send`).
- A frontend MUST NOT send a window request for a state without `EVENT`:
  there is no app event to name ([WM] `_z2ui5Send` logs it and sends
  nothing). *Frontend check:* `ui5.window-no-event`.
- A frontend that sends none shows the rows it was sent and cannot reach
  the others. What the frontends of this repository and the agent client
  do is in [../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables);
  whether they have to do more is
  [open question 13](open-questions.md#13-windowed-tables-in-frontends-that-are-not-the-ui5-frontend).
- The UI5 frontend's list binding - when it asks, what its `sort( )` and
  `filter( )` send, and which of two requests waiting behind a roundtrip
  it keeps - is the UI5 profile's:
  [../profiles/ui5.md](../profiles/ui5.md#windowed-tables).

## Core or profile

| Rule | Belongs to | Why |
|---|---|---|
| the window state in `MODEL`, the reserved key, `TOTAL` as the app holds it | core | it is in the response body of every view profile; a frontend that knows nothing of it still gets a model it must not misread |
| the window request, its arguments and how they reach the app - the event, `[reason, skip, top]`, `r_event_data` with the parsed parts | core | it is a request and a response of the core shape, and a rule of the **backend**: the same app must be handed the same request on every backend, whatever frontend asks |
| the rows and the order with the draft | core | it is the snapshot rule of [sessions.md](sessions.md#drafts-are-snapshots), for the attributes a windowed table needs |
| `__delta` rows are rows of the table, a whole table is written | core | it is what [request.md](request.md#the-model-delta) says for every table - the window adds no exception any more |
| *sending* window requests, and their shape when sent | optional for a frontend; the shape core | a frontend without them shows less, and nothing wrong; one with them must be understood by every backend |
| when a list asks for rows, how `sort( )` and `filter( )` of a UI5 list binding become arguments, the queue rule, `BINDING_CALL` | UI5 profile | they are properties of UI5's list binding and of the controls that drive it |
| sorting, filtering and counting | the app | the backend hands them over and applies none - two backends cannot differ in them |
| `window_bind_tab( )` in a portable app | not in portable v1 | a portable renderer shows the rows in the model ([../profiles/portable.md](../profiles/portable.md#6-frontend-actions)); the rows behind the window would be out of the user's reach |

That every conforming backend offers windowed tables is a provisional
decision:
[open question 12](open-questions.md#12-windowed-tables-as-a-part-of-the-core-protocol).
