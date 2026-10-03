
## 4. Binding forms

Core apps using each form (samples-controls in brackets). Property values are strings in the view XML; braces start a binding unless escaped as `\{`.

| form | example | core apps | v1 |
|---|---|---:|---|
| simple absolute path | `{/MV_VALUE}`, `{/S_SCREEN/COLOR_01}` | 160 (421) | yes - two-way for value-like properties (Input.value, CheckBox.selected, Switch.state, Select.selectedKey, …): the renderer writes user edits into the model and sends the delta with the next event |
| list (aggregation) binding on an aggregation attribute | `items="{/T_TAB}"` + one template child | 133 (387) | yes - template is cloned per array entry; relative paths resolve per entry |
| simple relative path (inside a template / element binding) | `{TITLE}` | 91 (312) | yes |
| object binding `{path: …}` | `{path:'/T_TAB', templateShareable:false}` | 15 (202) | yes for `path`, `parts`, `type`, `formatOptions`, `constraints`, `formatter` (below), `targetType`, `mode`; list bindings: `path`, `sorter: {path, descending}` (2 (77)), `templateShareable` (ignored), `length`/`startIndex` |
| string composite (text around / several bindings) | `{/MV_PERCENT} %` | 11 (97) | yes - concatenate formatted parts |
| expression binding | `{= ${/QUANTITY} > 500 }` | 11 (138) | yes, restricted grammar: `${path}` refs (absolute, relative, `device>`), string/number/boolean/null literals, `! && \|\| ?: === !== == != < <= > >= + - * / %`, parentheses, `.length`, and the functions `Math.max/min/abs/round/floor/ceil`, `.toUpperCase()/.toLowerCase()/.trim()/.indexOf()/.includes()/.startsWith()`. Everything else in an expression (RegExp, odata.*, encodeURIComponent, arbitrary JS) is excluded (1 core app uses such a call) |
| escaped literal braces | `.c \{ color:red \}` in `core:HTML` CSS | 9 (52) | yes - unescape |
| runtime-computed relative path | `|\{{ col-name }\}|` in generic tables; reconstructs as `{}` | 8 (0) | yes - it is a plain relative path at runtime |
| typed binding | `{path:'/AMOUNT', type:'sap.ui.model.type.Integer'}` | 3 (89) | yes for `sap.ui.model.type.` String, Integer, Float, Currency (with `parts: [amount, currency]`, 1 (57)), Date, Time, DateTime; formatOptions `minFractionDigits`, `maxFractionDigits`, `minIntegerDigits`, `maxIntegerDigits`, `groupingEnabled`, `decimals`, `style`, `pattern`, `source.pattern`, `showMeasure`, `showNumber`, `currencyCode`, `preserveDecimals`, `UTC`; constraints `minimum`, `maximum`, `minLength`, `maxLength` (parse errors -> `valueState="Negative"`). The `*Type` aliases need `core:require` (samples-controls only, excluded) |
| composite `parts` | `{parts:['/AMOUNT','/CURRENCY'], type:…}` | 3 (62) | yes (with a type or a v1 formatter) |
| abap2UI5 frontend formatters | `formatter: 'Formatter.DateAbapDateToDateObject'` | 4 (36) | yes for the three date helpers `Formatter.DateCreateObject` (2 (27)), `Formatter.DateAbapDateToDateObject` (1 (8)), `Formatter.DateAbapDateTimeToDateObject` (1 (0)) - they turn ABAP DATS/TIMS/ISO strings into JS Dates for `dateValue`-like properties. `Formatter.expandInlineIcons` (1) and any app function name are excluded |
| `device>` model | `{device>/system/phone}` | 1 (2) | yes - renderer provides `/system/{phone,tablet,desktop}`, `/resize/{width,height}`, `/support/touch`, `/orientation/{portrait,landscape}` |
| other named models | `{L0>FNAME}`, `{meta>ENTITY}`, `${L1>FNAME}` in expressions | 6 (8) | **no** - these come from XML templating (`template:repeat var=…`) and OData metadata; not portable |
| i18n `{i18n>key}` | - | 0 (0) | not used by any app - not in v1 |
| `odata.type.*` types | `sap.ui.model.odata.type.String` | 1 (1) | no |

## 5. Event wires

**Wire shapes on the attribute** (what abap2UI5 writes; 2,564 wires in all corpora):

| shape (ABAP -> XML) | wires | core apps | v1 |
|---|---:|---:|---|
| `client->_event( 'X' )` -> `.eB(['X'])` | 1,198 without args | 192 | yes |
| `client->_event( val = 'X' t_arg = … / arg = … )` -> `.eB(['X'], arg1, arg2, …)` | 579 with args | (incl.) | yes, args per the descriptor table below |
| `client->_event_nav_app_leave( )` (Page back button, Cancel) | 198 | 180 | yes - fires the framework's leave event |
| `client->follow_up_action( cs_event-… )` / `_event_client( )` in an attribute -> `.eF('ACTION', args…)` (frontend action on click, no roundtrip) | 583 | 22 | yes for the v1 actions of section 6 (CONTROL_GLOBAL - almost all MESSAGE_TOAST - 380 wires, CONTROL_BY_ID 118 (not v1), POPUP_CLOSE 30, URLHELPER 22, BINDING_CALL 22 (not v1)) |
| `s_ctrl-check_prevent_default` / `prevent_default_expr` -> `.eBP($event, cond, […])` | 18 | | `check_prevent_default=true` yes (call `preventDefault()` on the web-component event); `prevent_default_expr` no (UI5 expression on control objects) |
| `s_ctrl-check_queue_last` / `check_no_busy` -> flags in the event array `['X',false,false,false,queueLast,noBusy]` | 37 / 31 | | yes - renderer-side request queueing (keep only the last firing while a roundtrip runs) and "no busy overlay" |
| `s_ctrl-check_arg_literal` | 1 | | yes - quote every arg as a string |

`.eB` args are evaluated by UI5 as binding expressions when the event fires. **Event-argument descriptors** (core apps / samples-controls apps):

| descriptor | meaning | core | ctl | v1 |
|---|---|---:|---:|---|
| static literal `'ROW_1'` | constant string | 15 | 150 | yes |
| `${REL_PATH}` e.g. `${ID}` | field of the row (binding context) of the control that fired - the standard way to identify a table/list row | 29 | 21 | yes - renderer must evaluate in the clicked item's context |
| `${/ABS_PATH}` | current model value | 2 | 1 | yes |
| `${$source>/prop}` e.g. `${$source>/text}` (wires: Button press 17, Link press 19, CheckBox select 12) | a UI5 property of the control that fired | 4 | 22 | yes for any v1 property of that control (renderer maps the UI5 property name to its own state) |
| `${$parameters>/name}` | a UI5 event parameter | 23 | 168 | yes for this closed list: Input/TextArea `liveChange`/`submit`/`change` `value`; SearchField `search` `query` (`refreshButtonPressed`, `clearButtonPressed` = false), `liveChange` `newValue`, `suggest` `suggestValue`; Input `suggest` `suggestValue`; CheckBox `select` `selected`; Switch `change` `state`; ToggleButton `press` `pressed`; IconTabBar `select` `key`, `selectedKey`; DatePicker/DateTimePicker `change` `value`, `valid`; StepInput `change` `value`; MultiInput `change` `value`, `tokenUpdate` `type`; MultiComboBox/Table/List `selectionChange` `selected`; Panel `expand` `expand`. Parameters that are UI5 objects (`item`, `listItem`, `selectedItem`, `column`, `draggedControl`, `appointment`, …) are excluded |
| literal JSON / message template starting with `{`/`$` | e.g. MessageToast options `{ duration: 3000 }`, `'{0} activated'` | 5 | 13 | yes - passed through as data (only meaningful for v1 frontend actions) |
| method call on an event object `${$parameters>/selectedItem}.getKey()`, `.getBindingContext().getPath()`, `.indexOfItem()` | UI5 object API | 9 | 114 | **no** - replace with two-way bound `selectedKey`/`selected` or a `${REL}` arg |
| `$event.oSource.sId`, `$event.getSource().data('x')`, `$event.mParameters…` | raw UI5 event object | 7 | 83 | **no** |
| `$controller.slotValue( … )` / `textPath( )` | abap2UI5 controller helpers on the live UI5 tree | 1 | 0 | no |

The event NAMES a renderer must be able to fire are exactly the `events` lines of section 3 (press, change, liveChange, submit, select, selectionChange, search, valueHelpRequest, navButtonPress, afterClose, toggle-like expand, tokenUpdate, itemPress, detailPress, …). All are mapped to a web-component event in the control entries.

## 6. Frontend actions (`follow_up_action( )` / `_event_client( )`, cs_event)

Core apps using each action (call sites incl. view wires; samples-controls in brackets):

| action | core apps | v1 | renderer implementation |
|---|---:|---|---|
| SET_FOCUS | 20 (4) | yes | focus the control with that id (+ optional selection start/end) |
| CONTROL_GLOBAL `MESSAGE_TOAST.show` | 6 (111), 405 sites | yes | `ui5-toast` (text, `duration`, `at`/placement); also what `message_toast_display( )` produces (53 core apps) |
| CONTROL_GLOBAL `MESSAGE_BOX.show/alert/confirm/information/warning/error/success` | 6 (incl.) | yes | composed `ui5-dialog` with `state`, text, action buttons, `onClose` event; also `message_box_display( )` (45 core apps) |
| CONTROL_GLOBAL `BUSY_INDICATOR.show/hide`, `INVISIBLE_MESSAGE.announce`, `THEMING.setTheme` | 3 | yes | global `ui5-busy-indicator` overlay; aria-live region; WC `setTheme()` |
| CONTROL_GLOBAL `VIEW_SLOTS.destroy` = POPUP_CLOSE / POPOVER_CLOSE | 5 (17) | yes | close + remove the popup/popover slot |
| START_TIMER | 8 (8) | yes | `setTimeout` -> fire event |
| DOWNLOAD_B64_FILE, CLIPBOARD_COPY, URLHELPER (REDIRECT, TRIGGER_EMAIL/TEL/SMS…), OPEN_NEW_TAB | 4, 4, 3, 2 | yes | browser APIs (mobile: share/intent) |
| SCROLL_TO, SCROLL_INTO_VIEW | 2, 1 | yes | scroll the element with that id |
| SET_TITLE, SET_FAVICON, LOCATION_RELOAD, SYSTEM_LOGOUT, STORE_DATA, KEYBOARD_SHORTCUT, PLAY_AUDIO | 1-2 each | yes | trivial browser APIs (no-op where the platform has none) |
| HASH_ROUTING / HASH_SET / HASH_REPLACE / HASH_BACK / HASH_ATTACH_CHANGED / APP_STATE_SET_ACTIVE | 3, 1, 1, 1, 1, 1 | yes (browser renderers; no-op on native) | URL hash handling |
| SET_SIZE_LIMIT | 1 (14) | yes, no-op | a UI5 JSONModel list limit; irrelevant outside UI5 |
| CONTROL_BY_ID (call a UI5 control method by id: `to`, `openBy`, `open`, `removeItem`, `toggleBy`, `setExpanded`, `addStyleClass`, …) | 16 (108), 290 sites | **no** (v1.1: closed whitelist, see section 9) | open-ended UI5 method calls |
| BINDING_CALL (UI5 list-binding `filter`/`sort` on `items`) | 2 (20) | no (v1.1: portable filter/sort spec) | |
| BIND_ELEMENT, SET_ODATA_MODEL, SMART_VARIANT_INIT, FILTER_BAR_VARIANT_INIT, CROSS_APP_NAV_TO_EXT / _TO_PREV_APP, SET_TITLE_LAUNCHPAD, CONTROL_GLOBAL `ICON_POOL`/`POPUP`/`FORMATTING` | 1-2 each | **no** | UI5/OData/Fiori-launchpad specific |

**Client API (ABAP side) a v1 renderer must honour:** `view_display` (215 core apps), `popup_display`/`popup_destroy` (49/46), `message_toast_display` (53), `message_box_display` (45), `popover_display`/`popover_destroy` (11/3), `view_model_update`/`popup_model_update` (model-only refresh), `follow_up_action` (79, actions above); `nav_app_call`/`nav_app_leave` (35/46) and `get_event_arg` (49) are server-side and transparent. Not in v1: `nest_view_display`/`nest2_view_display` (6/2).

## 7. Explicit exclusions (v1)

- **Namespaces / families:** `sap.ui.comp` (smart controls, OData-annotation driven), `sap.uxap` (ObjectPage), `sap.f` (DynamicPage, FlexibleColumnLayout, Card, GridList - DynamicPage/FCL are v1.1), `sap.ui.table` (v1.1), `sap.ui.unified` (Calendar, FileUploader, Currency), `sap.suite.*`, `sap.viz`, `sap.gantt`, `sap.ui.vbm`, `sap.ui.vk`, `sap.ui.codeeditor`, `sap.ui.integration`, `sap.ndc`, `sap.ui.webc.*`, `sap.ui.core.dnd` / `sap.f.dnd` (drag & drop), `sap.m.plugins` (CellSelector, CopyProvider), `html:` elements in the view (use `core:HTML`).
- **abap2UI5 custom controls `z2ui5.cc.*`** (Tree, MultiInputExt, InputExt, FileUploader, Storage, Geolocation, CameraPicture/Selector, MessageManager, Dirty, Websocket, UITableExt, UploadSetExt, SmartMultiInputExt - 19 core apps): frontend extensions bound to the UI5 runtime. Each needs its own portable spec (several are non-visual device/browser services that map well to web/mobile APIs) - not part of the view profile.
- **XML templating** (`template:if/then/else/repeat/with`, `xmlns:template`) - 2 sample apps.
- **UI5 object access in event args** (`$event.*`, `.getX()` on parameters/sources, `$controller.*`), `prevent_default_expr`, named models other than `device`, `odata.*` types, app formatter functions, `core:require`, i18n models.
- **Members** not listed in section 3 (e.g. Table `inset`/`popinLayout`/`fixedLayout`, Column `popinDisplay`, ComboBox `showSecondaryValues`, Input `suggestionColumns`/`suggestionRows`/`showTableSuggestionValueHelp`, Panel `backgroundDesign`, Image `mode`) - a renderer ignores unknown properties (logs) and must not fail.

## 8. Renderer rules that fall out of the census

1. Two-way binding is the portable way to read UI state: 81 core apps bind `Input.value`, 9 `CheckBox.selected`, 10 `Switch.state`, 7 `Select.selectedKey`, 9 `SegmentedButton.selectedKey`, 10 `ColumnListItem.selected`. The renderer keeps the model in sync and sends the changed paths with the next event - exactly what the UI5 frontend does. This replaces all `.getKey()`/`$event` constructs.
2. Row identity comes from the binding context: `${REL}` args (29 core apps) and `ColumnListItem press` / `StandardListItem press` wires are evaluated against the clicked row.
3. Back navigation is ubiquitous (`Page showNavButton` + `navButtonPress=_event_nav_app_leave`, 185 core apps) - the Page header must be implemented first.
4. Popups are common (Dialog in 46 core apps, popup_display in 49); popovers need stable DOM ids for `opener`.
5. Messages: MessageStrip (153 core apps, mostly the sample description banner), MessageToast (53), MessageBox (45) - all three must be in a first renderer.
6. Forms are SimpleForm (70 core apps) with a flat Label/field list - the grouping algorithm of section 3 is required.
7. Tables are sap.m.Table (63 core apps) with ColumnListItem templates; growing is client-side paging over data that is already in the model.

## 9. v1.1 candidates (ordered by core apps unblocked)

| family | UI5 controls | core apps blocked (v1) | Web Component | fit / note |
|---|---|---:|---|---|
| grid table | sap.ui.table.Table, Column, RowAction, RowActionItem | 7 | `ui5-table` (+ `ui5-table-row-action`, `ui5-table-virtualizer`) | adapt: Column `label` + `template` instead of header/cells; `visibleRowCount`/`selectionMode`/`rowActionTemplate`; fixed columns and column menu (`sort`/`filter` events with `$parameters>/column` objects) not portable |
| message popover | sap.m.MessagePopover, MessageItem, MessageView | 4 (3 sole) | none - compose `ui5-popover`/`ui5-dialog` + `ui5-list` (`ui5-li` with highlight per type) | compose |
| page layouts | sap.f.DynamicPage (+Title, Header), sap.f.FlexibleColumnLayout, sap.m.NavContainer | 3 + 3 + 3 | `ui5-dynamic-page`/`-title`/`-header`, `ui5-flexible-column-layout` | adapt; NavContainer needs CONTROL_BY_ID `to`/`back` -> define a portable "page switch" |
| value-help dialogs | sap.m.TableSelectDialog, SelectDialog | 3 (2 sole) | none - compose `ui5-dialog` + `ui5-input` search + `ui5-table`/`ui5-list` | compose; `search`/`confirm` events with `$parameters>/value`, selected rows via two-way `selected` |
| quick view | sap.m.QuickView, QuickViewPage, QuickViewGroup, QuickViewGroupElement | 3 | none - compose `ui5-popover` | compose |
| menus | sap.m.Menu, MenuItem, MenuButton | 2 | `ui5-menu`, `ui5-menu-item`, `ui5-button` opener | direct |
| small inputs | TimePicker, Slider, RadioButton/RadioButtonGroup, RatingIndicator | 1 each (+ many in samples-controls: Slider 37, RadioButton 15) | `ui5-time-picker`, `ui5-slider`, `ui5-radio-button` (group via `name`), `ui5-rating-indicator` | direct |
| object display | ObjectAttribute, ObjectHeader, Avatar, FormattedText, Carousel, Breadcrumbs | 1 each (samples-controls: 43, 26, 40, …) | compose / `ui5-avatar` / limited HTML / `ui5-carousel` / `ui5-breadcrumbs` | mixed |
| full Form | sap.ui.layout.form.Form, FormContainer, FormElement (+ ResponsiveGridLayout) | 0 (18 samples-controls) | `ui5-form`, `ui5-form-group`, `ui5-form-item` | direct (simpler than SimpleForm) |
| ResponsivePopover | sap.m.ResponsivePopover | 0 (18) | `ui5-responsive-popover` | direct |
| nested views | `nest_view_display`, `nest2_view_display` | 3 (+3 with other blockers) | render a second view document into the control with the given id | protocol feature, no new control |
| CONTROL_BY_ID whitelist | `open`/`close`/`openBy`/`toggleBy` (Dialog, Popover), `setExpanded` (Panel), `focus`, `addStyleClass`/`removeStyleClass`/`toggleStyleClass`, `setText`, `setVisible` | 5 among v1-control-covered apps (16 overall) | renderer implements the named methods on its own components | defines the portable part of an open-ended action |
| BINDING_CALL | client-side `filter`/`sort` of a bound list | 2 | renderer-side filter/sort of the template rows | needs a declarative filter/sort spec |

Taking all v1.1 rows lifts control coverage from 73.7 % to 82.6 % of core apps (45.5 % of samples-controls); what stays out after that is the not-portable-by-design part (smart controls, z2ui5.cc custom controls, charts, drag & drop).
