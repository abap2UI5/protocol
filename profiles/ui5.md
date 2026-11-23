# UI5 profile

**Status: normative for protocol 3.** The views are UI5 XML, as the
`z2ui5_cl_ui5_view_builder` writes them ([IC] `view_display`), and the
frontend is the abap2UI5 UI5 SPA (`bundle/webapp`). Only that frontend
implements this profile fully; every backend serves it. Source
abbreviations: [../spec/README.md](../spec/README.md#sources).

## The page

`GET <endpoint>` answers the page that boots the UI5 frontend
([HTTP] `_http_get`):

- **200**, `Content-Type: text/html`, a document with the UI5 bootstrap
  script (`id="sap-ui-bootstrap"`, theme and source from the user exit), the
  embedded frontend (one inline script, its CSP hash added to the policy,
  [HTTP] `_csp_add_script_hash`) and the component container
  (`data-sap-ui-component`, `data-name="z2ui5"`, settings with
  `checkLocal: true`). *Checked by:* `ui5.page`.
- It carries no user data, so it SHOULD be cacheable with revalidation:
  `Cache-Control: private, no-cache` and an `ETag`; a matching
  `If-None-Match` is answered **304** without a body ([HTTP] `_http_get`,
  `_get_etag`). A compressed page carries the tag with a
  `-gzip` suffix, which the backend reads back ([NR] `compress`).
  *Checked by:* `ui5.page-revalidation`.
- `GET <endpoint>?z2ui5-bundle` answers the same frontend as one JavaScript
  file for hosts that embed the component (`@abap2ui5/embed-control`,
  [HTTP] `_http_get_bundle`).
- `GET <endpoint>?z2ui5-bundle=devtools` answers the frontend's developer
  tools as a JavaScript file of their own, with an `ETag` of its own - the
  page no longer carries them and loads them when they are first opened
  ([HTTP] `_http_get_devtools`; from abap2UI5 1.147.0 on). An app never
  needs it.

## Views

- A MAIN, NEST or NEST2 view is a `sap.ui.core.mvc.View` document
  (`<mvc:View xmlns:mvc="sap.ui.core.mvc" ...>`); a POPUP or POPOVER document
  is a `sap.ui.core.FragmentDefinition` (`<core:FragmentDefinition ...>`)
  whose root control is a `sap.m.Dialog` or `sap.m.Popover`
  ([IC] `popup_display`, `popover_display`). *Checked by:* `ui5.view-roots`.
- Any UI5 control, property, aggregation and namespace may appear - the
  builder maps UI5 XML one to one. Custom controls of the framework live in
  `z2ui5.cc` (abap2UI5 `bundle/webapp/cc/`), custom-control addons under the
  reserved resource roots `z2ui5_cci` and `z2ui5_ccc`.
- **Implementation note.** The set of `z2ui5.cc` controls belongs to the
  frontend release, not to the protocol. abap2UI5 1.149.0 removed the eight
  invisible ones - `z2ui5.cc.Timer`, `Focus`, `Scrolling`, `Title`,
  `LPTitle`, `Favicon`, `History` and `Info` - whose work the follow-up
  actions `START_TIMER`, `SET_FOCUS`, `SCROLL_TO` / `SCROLL_INTO_VIEW`,
  `SET_TITLE`, `SET_TITLE_LAUNCHPAD`, `SET_FAVICON`, the options of `NAV`
  and the session block do; a view that still names one fails to load
  there, like any view with a control the frontend cannot load
  ([../spec/errors.md](../spec/errors.md#what-a-frontend-does-with-it)).
- The page runs with complex binding syntax: a value containing `{` is a
  binding unless escaped (`\{`); text from data is escaped by the builder's
  `t` parameter ([IC], `z2ui5_cl_ui5_view_builder=>escape_literal`).

## Bindings

- A bound attribute appears as an absolute path of the default JSON model:
  `{/NAME}`, a structure component as `{/S_ADDR/CITY}`, a table as
  `items="{/T_ITEMS}"` with relative paths (`{TEXT}`) in the row template
  ([IC] `_bind`). *Checked by:* `ui5.binding-paths`.
- Every binding of the default model is two-way: the frontend tracks the
  changed paths of a model ([SL] `trackChanges`) and sends them as the model
  delta ([../spec/request.md](../spec/request.md#the-model-delta)).
- The named model `device>` is the frontend's (UI5 `sap.ui.Device`); `http`
  is the app's model when the MAIN view switched its default model to OData
  (`switchDefaultModelPath`).

## Event wires

The handler expressions the backend writes into view attributes
([EV] `get_event`, `get_event_client`); UI5 resolves the `$`-prefixed
arguments when the event fires, and the controller methods `eB`, `eBP` and
`eF` - names that are part of the protocol - run them ([V1]):

| Wire | Written by | Effect |
|---|---|---|
| `.eB(['EVENT'], arg...)` | `client->_event( val t_arg )` | a roundtrip with `EVENT` and `T_EVENT_ARG` = the arguments |
| `.eB(['EVENT', { queueLast: true, noBusy: true }], arg...)` | `_event( s_ctrl = ... )` with `check_queue_last` / `check_no_busy` | the same roundtrip with the wire's flags: one options object in position [1] of the event array, read by key ([below](#the-options-of-a-wire)) |
| `.eBP($event, <condition>, ['EVENT'], arg...)` | `s_ctrl-check_prevent_default` / `prevent_default_expr` | cancel the control's default when the condition holds, then roundtrip |
| `.eB(['___ZZZ_NAL'])` | `client->_event_nav_app_leave( )` | the reserved leave event ([../spec/navigation.md](../spec/navigation.md#the-reserved-leave-event)) |
| `.eF('ACTION', arg...)` | `client->_event_client( )`, a wired `follow_up_action( )` | a frontend action on the event, no roundtrip ([../spec/actions.md](../spec/actions.md#wired-frontend-actions)) |

- **The event array** is `['EVENT']` or `['EVENT', { <options> }]` - the
  name, and behind it the flags of the wire as one object. A backend MUST
  write a flag as a key of that object, only the flags that are set, and
  no object at all for a wire without one ([EV] `get_event`).
  *Checked by:* `ui5.event-wire-options`.
- Arguments are single-quoted string literals (backslash, quote and line
  breaks escaped, [EV] `get_t_arg`), or raw when they start with `$`
  or `{` (a binding or expression: `${ID}`, `${$source>/text}`,
  `${$parameters>/value}`, `$event`) - unless the wire asked for literal
  arguments (`s_ctrl-check_arg_literal`), or the braces of the argument do
  not balance: that is text, and is quoted ([EV] `check_arg_raw`). An
  empty argument between filled
  ones keeps its place as `''`. *Checked by:* `ui5.event-wire`,
  `ui5.leave-wire`, `ui5.frontend-wire`.
- An argument that is no plain data - a UI5 control or an array of them,
  a binding context, the event itself (`$event`) - is marshalled to plain
  data before it is sent ([LIB] `normalizeEventArgs`,
  [../spec/request.md](../spec/request.md#event-arguments)).
- A frontend implementing this profile MUST implement exactly these wire
  forms: they are written by every backend of protocol 3.
  *Frontend checks:* `ui5.wire-ebp`, `ui5.wire-source-argument`,
  `ui5.wire-queue-last`, `request.event-arguments`, `request.leave-event`,
  `slots.frontend-close`.

### The options of a wire

| Key | Written for | Meaning |
|---|---|---|
| `queueLast` | `s_ctrl-check_queue_last` | while a roundtrip runs, keep the **last** firing of this wire and send it after the response, instead of dropping it ([V1] `eB`, `_dispatchQueuedEvent`) - a live search loses no keystroke |
| `noBusy` | `s_ctrl-check_no_busy` | no busy indicator for this roundtrip; the frontend is busy all the same, and a second event is kept or dropped as ever ([V1] `eB`) |
| `useMainModel` | - (no backend writes it; views written by hand) | the event from a popup ships MAIN's model delta instead of the popup's ([V1] `_pickModelForRoundtrip`) |

The frontend reads the object by key and takes an absent key as `false`
([LIB] `eventOptions`). **Implementation note.** Up to protocol 2 the
flags were positions of the event array - `['EVENT', false, false,
false, <queueLast>, <noBusy>]`, [1] and [2] reserved, [3] the MAIN-model
flag. The UI5 frontend no longer reads them: a wire of that shape - a
view written by hand against the old form - fires as a wire without
flags, and the frontend logs it ([LIB] `eventOptions`).

## Frontend actions

The UI5 frontend implements every follow-up action of
[../spec/actions.md](../spec/actions.md#vocabulary), including the UI5-only
ones: `CONTROL_BY_ID` (a whitelisted method on a control resolved by id,
[CC] `evControlCallById`), the whitelisted globals of `CONTROL_GLOBAL`
([CC] `GLOBAL_TARGETS`: `MESSAGE_TOAST`, `MESSAGE_BOX`, `VIEW_SLOTS`,
`BUSY_INDICATOR`, `ICON_POOL`, `THEMING`, `POPUP`, `INVISIBLE_MESSAGE`,
`FORMATTING`), `BINDING_CALL`, `BIND_ELEMENT`, `SET_ODATA_MODEL` and the
variant and launchpad actions (`CROSS_APP_NAV_TO_EXT`,
`CROSS_APP_NAV_TO_PREV_APP`, `CROSS_APP_NAV_GET_LINKS`,
`SET_TITLE_LAUNCHPAD`, `SET_APP_FULL_WIDTH`, [LP]). The whitelist is the
safety boundary: an action name, target or method outside it is not
called ([FA] `execute`, `Object.create(null)` dispatch). The target
`VIEW_SLOTS` has one method, `destroy` - a view's own close wire; a
response says its views and its URL intent in `VIEWS` and `NAV`
([../spec/response.md](../spec/response.md#sections)), which the frontend
applies itself ([V1] `_applyViews`, [RT] `sync`). Until abap2UI5 DEV
`43d5f6a` (2026-11-23) the whitelist still held what protocol 2 had used
for that - `VIEW_SLOTS` `display` / `updateModel` and a target `ROUTER`
with `sync` - reachable from a view wire, written by nothing.

## Windowed tables

A list bound to a path that has a window state in the model
([../spec/windowed-tables.md](../spec/windowed-tables.md#the-window-state))
gets a list binding of the frontend's own instead of UI5's client-side one
([WM] `WindowModel.bindList`, `WindowListBinding`). The view says nothing
about it - the aggregation is bound as ever (`items="{/T_ROWS}"`,
`rows="{/T_ROWS}"`), and a path without a window state keeps the plain JSON
binding. Every request it sends is the app's event `EVENT` of the window
state behind `___ZZZ_WIN`
([../spec/windowed-tables.md](../spec/windowed-tables.md#the-window-request)),
through the slot's `eB` so that it carries the slot's model delta ([SL]
`createViewModel`: `eB(['___ZZZ_WIN', { noBusy: <noBusy> }], path, event,
reason, skip, top, ...)`); without an `EVENT` it sends nothing and logs
it ([WM] `_z2ui5Send`).

- **Length.** The binding answers its length with `TOTAL` (at least the
  rows it holds), as final: a growing `sap.m.Table` or `List` shows
  `[ 4 / 12 ]`, a `sap.ui.table.Table` a scrollbar over all rows ([WM]
  `getLength`, `isLengthFinal`).
- **More rows.** When a control asks the binding for contexts past the
  rows it holds, it sends `MORE` with `skip` the rows it holds and `top`
  whole windows - the rows needed rounded up to a multiple of `SIZE`, at
  most `TOTAL`, less the rows held - once per need (until the next model
  push), without the busy indicator ([WM] `getContexts`, `_z2ui5Ensure`,
  `update`). A growing `sap.m.Table` with a `growingThreshold` of `SIZE`
  asks for the second window with `["/T_ROWS", "ROWS", "MORE", "4", "4"]`.
- **Sort and filter.** `sort( )` and `filter( )` on the binding - the
  column menu of `sap.ui.table.Table` (`sortProperty`, `filterProperty`),
  the follow-up action `BINDING_CALL` - do not sort or filter in the
  browser: each keeps the new sorters or filters on the binding and sends
  `SORT` or `FILTER` with `skip` 0, `top` `SIZE`, and **both** parts - all
  the binding's sorters and all its filter groups
  ([WM] `sort`, `filter`, `_z2ui5Restart`, `_z2ui5Send`), so a filter
  after a sort sends the sort along. The filter sent is the binding's
  `Control` and `Application` filters together ([WM] `filterGroups`):
  filters on one path ORed, the paths ANDed, a multi-filter taken apart
  when it is an AND of conditions or of ORs of them; a `Date` value
  travels as `yyyy-MM-dd` ([WM] `wireValue`); a filter of another shape,
  or one with a test function, is not sent and logged.
- **Not applied.** Sorters and filters written into the binding info of
  the view are ignored for a windowed list - the rows arrive in the app's
  order ([WM] `WindowListBinding`, the constructor).
- **Two requests, one roundtrip.** A window request that comes while a
  roundtrip runs is kept and sent after it - per table, by the model that
  asked, so the lists of one page do not replace each other's requests,
  and one the frontend is idle for goes out with each landed roundtrip
  ([SL] `keepWindowRequest`, `dispatchQueuedWindows`; [V1]
  `_dispatchQueuedEvent`). Of two requests of the same table that wait
  there the later one wins - except that a `MORE` does not replace a
  waiting `SORT` or `FILTER`: the restart loads from the first row anyway,
  and the `skip` of the `MORE` counts rows of the old order ([WM]
  `keepRestart`). A kept request whose table is gone - the popup closed,
  the view replaced - is dropped. This is what the UI5 frontend does; no
  check drives it.
- A frontend implementing this profile MUST do the first three: views
  with growing lists and sortable columns over windowed tables are written
  by every backend with windowed tables. *Frontend checks:*
  `ui5.window-growth`, `ui5.window-sort-filter`, `ui5.window-no-event`.
