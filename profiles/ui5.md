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
  `_get_etag`, `_check_etag_match`). A compressed page carries the tag with a
  `-gzip` suffix, which the backend reads back ([NR] `compress`).
  *Checked by:* `ui5.page-revalidation`.
- `GET <endpoint>?z2ui5-bundle` answers the same frontend as one JavaScript
  file for hosts that embed the component (`@abap2ui5/embed-control`,
  [HTTP] `_http_get_bundle`).

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
  breaks escaped, [EV] `escape_js_string`), or raw when they start with `$`
  or `{` (a binding or expression: `${ID}`, `${$source>/text}`,
  `${$parameters>/value}`, `$event`) - unless the wire asked for literal
  arguments (`s_ctrl-check_arg_literal`). An empty argument between filled
  ones keeps its place as `''`. *Checked by:* `ui5.event-wire`,
  `ui5.leave-wire`, `ui5.frontend-wire`.
- A control-valued argument (a UI5 control or an array of them) is
  marshalled to plain data before it is sent ([LIB] `normalizeEventArgs`).
- A frontend implementing this profile MUST implement exactly these wire
  forms: they are written by every deployed backend.

## Frontend actions

The UI5 frontend implements every follow-up action of
[../spec/actions.md](../spec/actions.md#vocabulary), including the UI5-only
ones: `CONTROL_BY_ID` (a whitelisted method on a control resolved by id,
[CC] `evControlCallById`), the whitelisted globals of `CONTROL_GLOBAL`
([CC] `GLOBAL_TARGETS`: `MESSAGE_TOAST`, `MESSAGE_BOX`, `VIEW_SLOTS`, `ROUTER`,
`BUSY_INDICATOR`, `ICON_POOL`, `THEMING`, `POPUP`, `INVISIBLE_MESSAGE`,
`FORMATTING`), `BINDING_CALL`, `BIND_ELEMENT`, `SET_ODATA_MODEL`, the variant
and launchpad actions. The whitelist is the safety boundary: an action
name, target or method outside it is not called ([FA] `execute`,
`Object.create(null)` dispatch).
