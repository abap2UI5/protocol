# UI5 profile

**Status: normative for protocol 2.** The views are UI5 XML, as the
`z2ui5_cl_ui5_view_builder` writes them ([IC] `view_display`), and the
frontend is the abap2UI5 UI5 SPA (`app/webapp`). Only that frontend
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
  `z2ui5.cc` (abap2UI5 `app/webapp/cc/`), custom-control addons under the
  reserved resource roots `z2ui5_cci` and `z2ui5_ccc`.
- **Implementation note.** The set of `z2ui5.cc` controls belongs to the
  frontend release, not to the protocol. abap2UI5 1.149.0 removed the eight
  invisible ones - `z2ui5.cc.Timer`, `Focus`, `Scrolling`, `Title`,
  `LPTitle`, `Favicon`, `History` and `Info` - whose work the follow-up
  actions `START_TIMER`, `SET_FOCUS`, `SCROLL_TO` / `SCROLL_INTO_VIEW`,
  `SET_TITLE`, `SET_TITLE_LAUNCHPAD`, `SET_FAVICON`, the router options
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
| `.eB(['EVENT', false, false, false, <queueLast>, <noBusy>], ...)` | `_event( s_ctrl = ... )` | the event array read by position: [1], [2] reserved, [3] use the MAIN model from a popup (custom JS only), [4] keep the last firing while a roundtrip runs, [5] no busy indicator |
| `.eBP($event, <condition>, ['EVENT'], arg...)` | `s_ctrl-check_prevent_default` / `prevent_default_expr` | cancel the control's default when the condition holds, then roundtrip |
| `.eB(['___ZZZ_NAL'])` | `client->_event_nav_app_leave( )` | the reserved leave event ([../spec/navigation.md](../spec/navigation.md#the-reserved-leave-event)) |
| `.eF('ACTION', arg...)` | `client->_event_client( )`, a wired `follow_up_action( )` | a frontend action on the event, no roundtrip ([../spec/actions.md](../spec/actions.md#wired-frontend-actions)) |

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
  forms: they are written by every deployed backend. *Frontend checks:*
  `ui5.wire-ebp`, `ui5.wire-source-argument`, `ui5.wire-queue-last`,
  `request.event-arguments`, `request.leave-event`, `slots.frontend-close`.

## Frontend actions

The UI5 frontend implements every follow-up action of
[../spec/actions.md](../spec/actions.md#vocabulary), including the UI5-only
ones: `CONTROL_BY_ID` (a whitelisted method on a control resolved by id,
[CC] `evControlCallById`), the whitelisted globals of `CONTROL_GLOBAL`
([CC] `GLOBAL_TARGETS`: `MESSAGE_TOAST`, `MESSAGE_BOX`, `VIEW_SLOTS`, `ROUTER`,
`BUSY_INDICATOR`, `ICON_POOL`, `THEMING`, `POPUP`, `INVISIBLE_MESSAGE`,
`FORMATTING`), `BINDING_CALL`, `BIND_ELEMENT`, `SET_ODATA_MODEL`, the variant
and launchpad actions (`CROSS_APP_NAV_TO_EXT`, `CROSS_APP_NAV_TO_PREV_APP`,
`CROSS_APP_NAV_GET_LINKS`, `SET_TITLE_LAUNCHPAD`, `SET_APP_FULL_WIDTH`,
[LP]) and the experimental `OFFLINE_QUEUE` ([OFF]). The whitelist is the safety boundary: an action
name, target or method outside it is not called ([FA] `execute`,
`Object.create(null)` dispatch).

## Windowed tables

A list bound to a path that has a window state in the model
([../spec/windowed-tables.md](../spec/windowed-tables.md#the-window-state))
gets a list binding of the frontend's own instead of UI5's client-side one
([WM] `WindowModel.bindList`, `WindowListBinding`). The view says nothing
about it - the aggregation is bound as ever (`items="{/T_ROWS}"`,
`rows="{/T_ROWS}"`), and a path without a window state keeps the plain JSON
binding.

- **Length.** The binding answers its length with `TOTAL`, as final: a
  growing `sap.m.Table` or `List` shows `[ 4 / 12 ]`, a
  `sap.ui.table.Table` a scrollbar over all rows ([WM] `getLength`,
  `isLengthFinal`).
- **More rows.** When a control asks the binding for contexts past the
  rows it holds, it sends a window request for whole windows - `count` =
  the rows needed, rounded up to a multiple of `SIZE`, at most `TOTAL` -
  once per need, without the busy indicator, and kept (queue-last) when a
  roundtrip is in flight ([WM] `getContexts`, `_z2ui5Ensure`; [SL]
  `createViewModel`: `eB(['___ZZZ_WIN', false, false, false, true,
  <noBusy>], path, count)`).
- **Sort and filter.** `sort( )` and `filter( )` on the binding - the
  column menu of `sap.ui.table.Table` (`sortProperty`, `filterProperty`),
  the follow-up action `BINDING_CALL` - do not sort or filter in the
  browser: each sends a window request for one window that names its own
  part and nothing else, `[path, SIZE, sort]` or `[path, SIZE, "",
  filter]` ([WM] `sort`, `filter`, `_z2ui5Restart`, `_z2ui5Send`). The
  filter sent is the binding's `Control` and `Application` filters
  together ([WM] `filterGroups`): filters on one path ORed, the paths
  ANDed, a multi-filter taken apart when it is an AND of conditions or of
  ORs of them; a `Date` value travels as `yyyy-MM-dd`; a filter of another
  shape, or one with a test function, is not sent and logged.
- **Not applied.** Sorters and filters written into the binding info of
  the view are ignored for a windowed list - the rows arrive in the
  backend's order ([WM] `WindowListBinding`, the constructor).
- A frontend implementing this profile MUST do the first three: views
  with growing lists and sortable columns over windowed tables are written
  by every backend from abap2UI5 1.149.0 on. *Frontend checks:*
  `ui5.window-growth`, `ui5.window-sort-filter`.
