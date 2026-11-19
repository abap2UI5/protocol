# Windowed tables

A **windowed table** is a table the backend sends a window at a time: the
model carries the first rows of it, the rest stays on the backend, and the
frontend asks for more as its list grows or scrolls. Sorting and filtering
run on the backend, over all rows. An app asks for one with
`window_bind_tab( val = t_rows window = 100 )` instead of `_bind( )`
([IC]); in abap2UI5 from 1.149.0 on.

Three things travel for it, all inside the messages of
[request.md](request.md) and [response.md](response.md):

- the **window state** `/__WINDOW/<path>` in `MODEL`, next to the rows;
- the **window request**, an event request with the reserved event
  `___ZZZ_WIN`, which the backend answers without running the app;
- **edits**: the rows of a `__delta` on a windowed table are positions in
  the order the backend sent.

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
    "__WINDOW": { "T_ROWS": { "TOTAL": 12, "COUNT": 4, "SIZE": 4 } } } }
```

For a windowed table at the model path `/<path>`, `MODEL` carries
([MOD] `window_ref`, [TY] `cv_window_model_key`):

- at `/<path>` the **first `COUNT` rows** of the table in the backend's
  order ([below](#the-order-is-the-backends)) - not the table;
- at `/__WINDOW/<path>` the window state, three integers:

| Key | Meaning |
|---|---|
| `TOTAL` | the rows the filter lets through - the length of the list |
| `COUNT` | the rows this model carries: the window the frontend asked for, at least one window, at most `TOTAL` |
| `SIZE` | the rows of one window, as the app set it (`window`, at least 1; [CL] `window_bind_tab`) |

The state mirrors the path: a table in a structure at `/S_DATA/T_ROWS` has
its state at `/__WINDOW/S_DATA/T_ROWS`, a table behind a data reference,
which the model carries at `/MR_TAB/*`, at `/__WINDOW/MR_TAB/*` ([WM]
`windowName`; the release's own test `node/tests/e2e/window.spec.js` reads
`MODEL.__WINDOW.MR_TAB["*"]` - the conformance app has no such table, so
this is not in the recorded traffic).

- A backend MUST send, in every `MODEL` that carries a windowed table, the
  rows of the window at the table's path and the window state with `TOTAL`,
  `COUNT` and `SIZE` under `/__WINDOW/<path>`. `MODEL` stays complete
  ([response.md](response.md#model)): every other bound attribute is in it
  as before. *Checked by:* `window.first-window`.
- `__WINDOW` is a reserved key of the model. An app MUST NOT bind an
  attribute of that name; a view MAY bind the state
  (`{/__WINDOW/T_ROWS/TOTAL}`, [TY] `cv_window_model_key`).

## The window request

```json
{ "value": { "S_FRONT": { "ID": "5290E847062342FC9E654EF8A355FCF7", "EVENT": "___ZZZ_WIN", "T_EVENT_ARG": ["/T_ROWS", "8"] } } }
```

A window request is an [event request](request.md#event-requests) with the
reserved event `___ZZZ_WIN` ([TY] `cs_event_window`, [WM] `EVENT`). It
continues a draft like any event and carries the model delta like any event
([SL] `createViewModel`: it goes through the slot's `eB`). Its arguments:

| `T_EVENT_ARG` | Meaning |
|---|---|
| `[path, count]` | more rows: the first `count` rows of the order the backend holds |
| `[path, count, sort]` | a new sort: the first `count` rows of the new order |
| `[path, count, "", filter]` | a new filter of the list: the first `count` rows that pass |
| `[path, count, sort, filter]` | both |

`path` is the model path of the table with its leading slash (`/T_ROWS`),
`count` the rows wanted **counted from the first row** - not an offset and
not a number of additional rows; the UI5 frontend sends it as a string
([WM] `_z2ui5Send`). `sort` and `filter` are the texts of JSON arrays
([below](#sorters-and-filters)). Recorded from the UI5 frontend's own code
in [`traffic/node-runtime/ui5-frontend.json`](../traffic/node-runtime/ui5-frontend.json)
(the `WINDOW:` exchanges).

Rules for the backend ([H] `main_process`, [WIN] `event_apply`):

- A backend MUST NOT run the app for a window request: `main( )` is not
  called, the app sees no event. It applies the model delta the request
  carries, changes the window of the table at `path` as the arguments say,
  and answers a normal response - a new draft id
  ([sessions.md](sessions.md#draft-ids)), the same `APP`, no view and no
  action of its own, and the complete `MODEL` with the new window and its
  state (no bound value changed, so the automatic push of
  [response.md](response.md#model) would not send it; [H] `main_process`
  marks the model stale instead). *Checked by:* `window.more-rows`.
- `count` rows are answered from the first row of the order, never fewer
  than one window and never more than `TOTAL`: a `count` past the rows
  answers all of them, and a `count` that is no plain number SHOULD be read
  as one window, never fail the request ([WIN] `event_apply`: digits only,
  nine at most). *Checked by:* `window.count-bounds`.
- A window request whose `path` names no windowed table of the app SHOULD
  change nothing and be answered like an event the app does not handle
  ([WIN] `event_apply` answers `abap_false`; the reference then sends no
  `MODEL`). *Checked by:* `window.unknown-path-ignored`.
- `___ZZZ_WIN` is a reserved event name
  ([request.md](request.md#event-requests)). An app MUST NOT use it.

## Sorters and filters

The two optional arguments are JSON **texts** - strings in `T_EVENT_ARG`,
not JSON values ([WM] `_z2ui5Send` stringifies them; the backend would
receive an array's JSON text either way,
[request.md](request.md#event-arguments)):

```
sort    [{ "PATH": "QTY", "DESCENDING": true }, { "PATH": "NAME", "DESCENDING": false }]
filter  [[["QTY", "GT", 8, null]], [["NAME", "Contains", "1", null], ["ID", "EQ", 5, null]]]
```

- **Sorters** ([WIN] `parse_sort`, `sort_index`): an array of `{ PATH,
  DESCENDING }`, applied in order - the first sorter that tells two rows
  apart decides, rows no sorter tells apart keep the order of the table
  (the sort is stable). `PATH` is a column of the row, matched without
  regard to case.
- **Filter groups** ([WIN] `parse_filter`, `filter_row`): an array of
  groups, each an array of conditions `[path, operator, value1, value2]`.
  The **groups are ANDed, the conditions of one group ORed** - the shape
  UI5 gives the filters of a list binding (the conditions on one column
  ORed, the columns ANDed; [WM] `filterGroups`). `operator` is a
  `sap.ui.model.FilterOperator` name: `EQ`, `NE`, `LT`, `LE`, `GT`, `GE`,
  `BT`, `NB` (with `value2` as the upper bound), `Contains`,
  `NotContains`, `StartsWith`, `NotStartsWith`, `EndsWith`, `NotEndsWith`
  ([TY] `ty_s_window_filter`). A column is compared as what it is: numbers
  as numbers, dates (`yyyy-MM-dd` or `yyyyMMdd`), times and booleans
  (`true` / `false`) as such, text without regard to case ([WIN]
  `kind_of`, `value_key`, `cond_check`).
- A backend MUST sort and filter **all** rows of the table, not the ones
  the frontend holds, and answer the first `count` rows of the result;
  `TOTAL` counts the rows the filter lets through. *Checked by:*
  `window.sort`, `window.filter`.
- **A part that is missing, empty or `null` says nothing**, and the backend
  MUST keep what it holds for that part; a part that is a JSON array - the
  empty array `[]` included - replaces it, so `[]` **clears** it ([WIN]
  `arg_is_said`, `event_apply`). A request for more rows names neither
  part; a request that names a filter and no sort sends the sort as `""`.
  *Checked by:* `window.parts-kept-and-cleared`.
- **Implementation note.** A sorter that names no column of the row is
  ignored, a condition that names none matches no row, and a sort or
  filter text the backend cannot parse counts as an empty one ([WIN]
  `sort_cols`, `cond_prepare`, `parse_sort`, `parse_filter`). A frontend
  cannot rely on any of the three.

## The order is the backend's

One order - a sort and a filter - is kept per windowed table, **on the
backend, with the draft** ([TY] `ty_s_attri`: `t_window_sort`,
`t_window_filter`, `window_count`; [WIN], the class header). No response
names it: the frontend learns `TOTAL`, `COUNT` and `SIZE` and nothing of
the sort or the filter, so it has nothing to send back. Two parties change
it - the app, with `t_sort` / `t_filter` of `window_bind_tab( )`, and the
frontend's list, with a window request that names a part:

- A request for more rows changes no part of the order. A backend MUST
  answer more rows of the **same** order, whoever set it - the app or an
  earlier window request. *Checked by:* `window.growth-keeps-order`.
- There is **one sort**: the last one set, by the app or by a window
  request. A window request that names a filter does not touch it.
  *Checked by:* `window.sort-last-set`.
- The **filter has two parts, which are ANDed**: the app's (`t_filter`)
  and the list's (the `filter` argument). Each is replaced, and cleared,
  by its own side alone - a filter of the list narrows what the app's lets
  through, a new filter of the app keeps the list's ([WIN] `filter_merge`,
  [BND] `window_adopt`). *Checked by:* `window.filters-anded`.
- The order, the window and the rows belong to the **draft**
  ([sessions.md](sessions.md#drafts-are-snapshots)): a request that
  continues an earlier draft continues that draft's order and rows, also
  after later drafts sorted, filtered or edited. *Checked by:*
  `window.order-with-the-draft`.
- **What the app's `t_sort` / `t_filter` do** is the client API's and
  decided in one place ([BND] `window_adopt`): they take effect when they
  differ from the ones the app passed the time before - so a view rendered
  again with the same parameters keeps what the user sorted and filtered -
  and an order the app sets starts from one window again. An app can set
  it without displaying a view; the model is pushed with the new window.
- **Implementation note.** The reference computes the order when it needs
  it - for the rows of a response and for the rows a delta means - and
  stores no list of row numbers ([WIN] `index`). Between the two the table
  does not change, and the sort is stable, so both see the same order.

## Edits

- The row keys of a `__delta` ([request.md](request.md#the-model-delta))
  on a windowed table are **positions** in the order the backend sent with
  the draft the request continues, 0-based - not rows of the table. A
  backend MUST write the cells into the rows behind those positions ([MOD]
  `delta_apply_nodes`, [WIN] `index`); a position past the rows the filter
  lets through is a row that does not exist. The delta is applied before
  the app runs and before a window request changes the order - an edit
  that travels with a sort lands in the row it was made in. The same
  holds behind a data reference, where the `__delta` is on the `*` node
  (`/MR_TAB/*`, [MOD] `main_json_to_attri`). *Checked by:*
  `window.delta-positions`, `window.delta-positions-reference`.
- A backend MUST NOT write a **whole table value** over a windowed table:
  what a frontend holds is a window, and the window written back would cut
  the table down to it ([MOD] `main_json_to_attri`). It SHOULD report the
  refused value to the app like a cell it could not write (the reference
  lists it in `get( )-t_model_skipped`, [MOD] `whole_value_trace`).
  *Checked by:* `window.whole-table-refused`.
- A frontend therefore MUST send an edit of a windowed table as a
  `__delta` whose row keys are the positions of the rows in the model it
  holds, and MUST NOT send the table whole - the alternative
  [request.md](request.md#the-model-delta) allows for other tables - nor
  the `__WINDOW` key. *Frontend check:* `window.edit-as-delta`. A
  windowed table behind a data reference (model node `/MR_TAB/*`, state at
  `/__WINDOW/MR_TAB/*`) gets the same `__delta` on its `*` node,
  `{ "MR_TAB": { "*": { "__delta": { ... } } } }`
  ([request.md](request.md#the-model-delta)). *Frontend check:*
  `window.edit-as-delta-reference`.
- **Implementation note.** The UI5 frontend sends the whole attribute for
  a changed path that is no cell ([LIB] `buildDeltaFromPaths`, "any other
  shape"); on a windowed table that value is refused. Up to abap2UI5
  1.149.0 a cell behind a data reference (`/MR_TAB/*/<row>/<field>`) was
  such a shape: the edit, or the pick of a `TableSelectDialog` over such a
  table, was dropped. The frontend of 2cc0344 (#3026) sends the `__delta`
  on the `*` node ([../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables)). The app reads the
  row behind a position an event hands over (`/T_ROWS/5` of a binding
  context) with `window_get_row( )` ([IC]).

## Frontends

- Every frontend MUST adopt a `MODEL` that carries `/__WINDOW`: the key is
  no attribute of the app, the rows at a windowed path are the rows to
  show, in the order they came. A frontend SHOULD NOT sort or filter the
  rows of a windowed table itself - it holds a part of them ([WM]
  `applySort`, `applyFilter` do nothing for a windowed list). *Frontend
  check:* `window.rows-shown`.
- A frontend MAY send window requests. One that does MUST send them as
  [above](#the-window-request), with the `ID` of the response it adopted
  last, and MUST name only the part of the order it was just told to set:
  nothing for more rows, the sorters for a sort, the filter groups for a
  filter ([WM], the header: the order is the backend's and the list does
  not know it). After a new sort or filter it SHOULD ask for one window
  ([WM] `_z2ui5Restart`).
- A frontend that sends none shows the first `COUNT` rows and cannot reach
  the others. What the frontends of this repository and the agent client
  do is in [../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables);
  whether they have to do more is
  [open question 13](open-questions.md#13-windowed-tables-in-frontends-that-are-not-the-ui5-frontend).
- The UI5 frontend's list binding - when it asks, and what its `sort( )`
  and `filter( )` send - is the UI5 profile's:
  [../profiles/ui5.md](../profiles/ui5.md#windowed-tables).

## Core or profile

| Rule | Belongs to | Why |
|---|---|---|
| the window state in `MODEL`, the reserved key | core | it is in the response body of every view profile; a frontend that knows nothing of it still gets a model it must not misread |
| the window request and its arguments, keep / clear, the one sort, the two filters, the order with the draft | core | it is a request and a response of the core shape, and a rule of the **backend**: the same app must sort and filter alike on every backend, whatever frontend asks |
| `__delta` rows are positions, a whole table is refused | core | it changes what an existing core message means for such a table - every frontend that edits a cell is bound by it |
| *sending* window requests | optional for a frontend | a frontend without them shows less, and nothing wrong |
| when a list asks for rows, how `sort( )` and `filter( )` of a UI5 list binding become arguments, `BINDING_CALL` | UI5 profile | they are properties of UI5's list binding and of the controls that drive it |
| `window_bind_tab( )` in a portable app | not in portable v1 | a portable renderer shows the rows in the model ([../profiles/portable.md](../profiles/portable.md#6-frontend-actions)); the rows behind the window would be out of the user's reach |

That every conforming backend offers windowed tables from this revision on
is a provisional decision:
[open question 12](open-questions.md#12-windowed-tables-as-a-part-of-the-core-protocol).
The protocol number stays 2 ([versioning.md](versioning.md#compatible-changes-within-protocol-2)):
a frontend written before reads the rows as a short table and ignores the
key, and a backend written before never sends it.

**Implementation note - the draft.** From abap2UI5 1.149.0 on the draft
carries a windowed table next to the app's serialization, and reuses the
serialized rows of the previous draft while they did not change ([TY]
`ty_s_kept`, [MOD] `main_kept_detach`). None of it is on the wire: the
messages of a windowed table are the ones above whether or not the rows
were serialized again, and a draft read back answers as the roundtrip left
it (`window.order-with-the-draft` continues the same draft twice).
