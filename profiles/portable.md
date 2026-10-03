# Portable view profile v1

**Status: normative, version 1.** Machine-readable form:
[`portable-v1.json`](portable-v1.json) (shape:
[`../schema/portable-profile.schema.json`](../schema/portable-profile.schema.json)).
Coverage data: [`portable-coverage.md`](portable-coverage.md). Method and
caveats of the census the list is drawn from: [section 10](#10-method-and-caveats).

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are to be read as in
RFC 2119 ([../spec/README.md](../spec/README.md#conventions)).

## 1. What the profile is

The core protocol ([../spec/core.md](../spec/core.md)) moves views as opaque
strings: a frontend that implements it can display *something* for every
`VIEW_SLOTS display`, but only the UI5 frontend understands every view an
abap2UI5 app can send, because the view vocabulary is the whole of UI5 XML
([ui5.md](ui5.md)).

The portable profile is a **subset of that vocabulary** - the same view XML,
the same JSON model, the same event wires, no new ABAP API - that every
conforming non-UI5 frontend renders. An app whose views stay inside it runs
unchanged on the UI5 frontend and on any portable renderer (UI5 Web
Components first, later Adaptive Cards or native mobile).

It was chosen from what apps actually use: 61 rendered controls and 4
layout-data elements, which cover **73.7 %** of the 247 core apps by
controls; **64.8 %** (160 apps) stay inside every rule of this page and run
unchanged ([section 10](#10-method-and-caveats), [portable-coverage.md](portable-coverage.md)).

### Conformance

- A **portable app** is an app whose every document (main view, popup,
  popover) uses only the controls, members, binding forms, event wires,
  event-argument descriptors, frontend actions and client API calls this
  page allows. `portable-v1.json` is the list a linter checks against.
- A **portable frontend** implements the core protocol and MUST render every
  portable app correctly: every control of [section 3](#3-controls), every
  member listed for it, every allowed binding form, event wire, descriptor
  and frontend action.
- A portable frontend MUST NOT fail on anything outside the profile. An
  unknown property or aggregation is ignored (and SHOULD be logged); an
  element of an unknown control or of a namespace outside
  [section 2](#2-documents-slots-and-namespaces) is replaced by a visible
  placeholder; an unknown frontend action is skipped with a log line - the
  same tolerance the UI5 frontend shows for an unknown action
  (`FrontendAction.execute`, abap2UI5 `app/webapp/core/FrontendAction.js`).
- The UI5 frontend renders every portable app (the profile is a subset of
  the UI5 profile), but the tolerance rule above is not its: a UI5-profile
  frontend has no "outside" - any UI5 element may appear - and an element
  it cannot load (an unknown namespace) fails the view like any view that
  does not build ([FA] `executeSystem`, [errors.md](../spec/errors.md#what-a-frontend-does-with-it)).
  The tolerance rule binds the portable renderers that are not UI5
  frontends. (Revision 0.1 said "a portable frontend by construction"; the
  frontend suite showed the UI5 SPA failing the view on
  `<x:Gadget xmlns:x="com.example.conformance"/>` with a module load error.)
- *Frontend checks:* `portable.default-aggregation`,
  `portable.unknown-property`, `portable.unknown-control`,
  `portable.excluded-action`, `portable.box-details`, `portable.timer`,
  `portable.set-title`, `portable.view-replaced`.

## 2. Documents, slots and namespaces

- **Documents.** A MAIN view is a `sap.ui.core.mvc.View` (`<mvc:View>`); a
  POPUP or POPOVER document is a `sap.ui.core.FragmentDefinition`
  (`<core:FragmentDefinition>`). The root attributes `displayBlock` and
  `height` are layout hints; `xmlns` / `xmlns:<prefix>` declare namespaces.
  `core:require` is outside the profile.
- **Slots.** A portable app uses the slots MAIN (`view_display`), POPUP
  (`popup_display`, `popup_destroy`) and POPOVER (`popover_display( xml
  by_id )`, `popover_destroy`). The nested slots NEST and NEST2 are not in v1
  (6 core apps use them; [section 9](#9-v11-candidates-informative)), and
  the two sides of that are separate rules (decided in revision 0.3,
  [open question 1](../spec/open-questions.md#1-the-nest-slots-in-portable-renderers)):
  - A portable **app** MUST NOT use them (`nest_view_display`,
    `nest2_view_display` and their destroys are outside the client API of
    [section 6](#6-frontend-actions)). The abap2UI5 linter's portable rule
    reports the calls; an app that needs nested views is a UI5-profile app.
  - A portable **renderer** tolerates them: one that receives a NEST/NEST2
    display MAY show a placeholder for it, but MUST process the action (it
    is core protocol, [../spec/response.md](../spec/response.md#view-slots))
    without failing the roundtrip. *Frontend check:* `slots.nest-processed`.
- **Namespaces.** `sap.m`, `sap.ui.core`, `sap.ui.core.mvc`, `sap.ui.layout`,
  `sap.ui.layout.form`, `sap.tnt`.
- **Elements.** An element whose local name starts with an upper-case letter
  is a control; a lower-case element in the parent's namespace is an
  aggregation of the enclosing control. A control's **default aggregation**
  MAY be written with or without its element (`<VBox><items>...</items></VBox>`
  equals `<VBox>...</VBox>`); a frontend MUST accept both.
- **Universal attributes** on every control: `id`, `class`, `visible`
  (bindable), `tooltip` (text or binding), `busy`, `busyIndicatorDelay`,
  `fieldGroupIds` (accepted, no effect), `binding` (an element binding: the
  context of the relative bindings below it), and the aggregations
  `layoutData`, `customData`, `dependents` (dependent controls are rendered
  hidden, e.g. a dialog opened later). `Label.labelFor` (an association) is
  accepted.
- **Ids.** A frontend MUST keep every view id addressable within its slot:
  the popover anchor (`openById`), SET_FOCUS, SCROLL_TO and
  `Label.labelFor` address controls by the id the view gave them.
- **CSS classes.** `class` values are passed through. The UI5 spacing
  helpers (`sapUiSmallMargin`, `sapUiTinyMarginTop`, ...,
  `sapUiContentPadding`, `sapUiResponsiveMargin`; 18 of the 22 classes core
  apps use) MUST be honoured as margins/paddings of 0.25 / 0.5 / 1 / 2 rem
  (Tiny / Small / Medium / Large). Other classes are the app's, styled by its
  own `core:HTML` `<style>` content - a selector written against the UI5 DOM
  (`.sapMInputBaseInner`) is not expected to match.
- **Tolerated elements** - `sap.ui.core.CustomData`, `sap.m.FlexItemData`,
  `sap.ui.layout.GridData`, `sap.m.OverflowToolbarLayoutData` - carry no UI.
  A frontend applies what it can (`data-*` for `CustomData writeToDom`,
  flex grow/shrink/basis, grid span, overflow priority) and MAY drop the
  rest; it MUST NOT fail on them.

## 3. Controls

Every control below MUST be rendered, and every member listed for it MUST be
accepted - applied where the target has a counterpart, accepted without
visual effect where [Appendix A](#appendix-a-ui5-web-components-mapping-informative)
says "ignored". A member is in v1 when at least one core app or at least
eight samples-controls apps use it (plus a few cheap ones added by hand);
the universal attributes of section 2 are not repeated. The figures are
core apps / samples-controls apps of the census.

<!-- portable:controls:begin - generated from portable-v1.json by scripts/render-portable.mjs, do not edit -->

### Layout & containers

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.Page | 195 / 162 | `backgroundDesign` (0/6), `enableScrolling` (0/23), `showFooter` (0/2), `showHeader` (5/120), `showNavButton` (185/36), `title` (188/42), `titleLevel` (0/2) | `customHeader` (2/34), `footer` (10/30), `headerContent` (7/4), `subHeader` (1/13) (default: `content`) | `navButtonPress` (185/20) |
| sap.m.Shell | 193 / 15 | - | - (default: `app`) | - |
| sap.m.VBox | 72 / 194 | `alignItems` (2/15), `height` (5/14), `justifyContent` (4/14), `renderType` (0/9), `width` (2/8), `wrap` (0/1) | - (default: `items`) | - |
| sap.ui.layout.form.SimpleForm | 70 / 115 | `adjustLabelSpan` (2/18), `columnsL` (1/44), `columnsM` (1/44), `columnsXL` (1/24), `editable` (65/110), `emptySpanL` (0/50), `emptySpanM` (0/50), `emptySpanS` (0/29), `emptySpanXL` (0/14), `labelSpanL` (3/65), `labelSpanM` (3/65), `labelSpanS` (2/41), `labelSpanXL` (2/24), `layout` (11/112), `maxContainerCols` (0/30), `singleContainerFullSize` (0/15), `width` (0/32) | `title` (53/45) (default: `content`) | - |
| sap.m.HBox | 35 / 64 | `alignItems` (12/25), `height` (0/4), `justifyContent` (1/18), `renderType` (0/13), `width` (0/7), `wrap` (7/2) | - (default: `items`) | - |
| sap.m.Panel | 15 / 71 | `backgroundDesign` (0/14), `expandable` (4/5), `expanded` (3/4), `headerText` (14/28), `height` (0/13), `stickyHeader` (0/1), `width` (5/36) | `headerToolbar` (0/21) (default: `content`) | `expand` (0/1) |
| sap.ui.layout.Grid | 13 / 26 | `defaultSpan` (11/25), `hSpacing` (0/17), `width` (0/11) | - (default: `content`) | - |
| sap.m.FlexBox | 7 / 54 | `alignItems` (5/36), `columnGap` (0/1), `direction` (1/12), `fitContainer` (0/25), `gap` (0/1), `height` (2/7), `justifyContent` (3/12), `renderType` (1/5), `rowGap` (0/1), `width` (1/5), `wrap` (1/25) | - (default: `items`) | - |
| sap.m.ScrollContainer | 4 / 24 | `height` (4/20), `horizontal` (1/15), `vertical` (4/22), `width` (0/12) | - (default: `content`) | - |
| sap.m.IconTabFilter | 4 / 35 | `count` (0/17), `design` (0/3), `enabled` (0/1), `icon` (2/16), `iconColor` (0/9), `key` (4/32), `text` (4/29) | - (default: `content`) | - |
| sap.m.IconTabBar | 3 / 30 | `applyContentPadding` (1/2), `expandable` (2/2), `expanded` (2/9), `headerBackgroundDesign` (0/3), `headerMode` (1/4), `selectedKey` (2/8) | `content` (1/7), `items` (3/30) | `select` (2/6) |
| sap.ui.layout.VerticalLayout | 2 / 174 | `width` (2/110) | - (default: `content`) | - |
| sap.ui.core.Title | 1 / 55 | `text` (1/55) | - | - |
| sap.ui.layout.HorizontalLayout | 0 / 52 | `allowWrapping` (0/12) | - (default: `content`) | - |

### Toolbars & bars

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.OverflowToolbar | 43 / 113 | `height` (0/12), `style` (0/22) | - (default: `content`) | - |
| sap.m.ToolbarSpacer | 37 / 117 | `width` (1/5) | - | - |
| sap.m.Toolbar | 16 / 55 | `height` (0/12), `style` (1/0) | - (default: `content`) | - |
| sap.m.Bar | 2 / 40 | - | `contentLeft` (2/9), `contentMiddle` (0/9), `contentRight` (2/34) | - |
| sap.m.OverflowToolbarButton | 2 / 37 | `enabled` (0/1), `icon` (2/37), `text` (2/31), `type` (0/30) | - | `press` (2/12) |

### Display

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.Text | 115 / 310 | `emptyIndicatorMode` (0/1), `maxLines` (0/1), `renderWhitespace` (1/2), `text` (102/307), `textAlign` (0/1), `width` (1/14), `wrapping` (1/42) | - | - |
| sap.m.Label | 86 / 286 | `design` (0/8), `required` (2/8), `showColon` (0/1), `text` (76/285), `textAlign` (0/1), `width` (1/9), `wrapping` (0/17) | - | - |
| sap.m.Title | 58 / 181 | `level` (10/53), `text` (51/178), `textAlign` (0/1), `titleStyle` (0/25), `wrapping` (1/43) | - (default: `content`) | - |
| sap.m.ObjectStatus | 17 / 51 | `active` (0/2), `icon` (2/6), `inverted` (0/3), `state` (11/50), `text` (16/51), `title` (6/18) | - | `press` (0/1) |
| sap.m.Link | 14 / 94 | `emphasized` (0/2), `enabled` (0/1), `endIcon` (0/1), `href` (11/45), `icon` (0/1), `target` (13/31), `text` (12/93), `wrapping` (0/1) | - | `press` (3/35) |
| sap.m.ObjectIdentifier | 7 / 50 | `text` (7/45), `title` (1/47), `titleActive` (0/3) | - | `titlePress` (0/3) |
| sap.ui.core.HTML | 7 / 60 | `content` (5/60) | - | - |
| sap.ui.core.Icon | 6 / 18 | `alt` (0/1), `color` (1/3), `size` (5/6), `src` (5/17), `width` (0/1) | - | `press` (1/1) |
| sap.m.ObjectNumber | 5 / 50 | `emphasized` (0/14), `number` (5/50), `state` (2/29), `unit` (3/49) | - | - |
| sap.tnt.InfoLabel | 4 / 4 | `colorScheme` (2/3), `icon` (1/1), `text` (4/4) | - | - |
| sap.m.ProgressIndicator | 3 / 21 | `displayOnly` (0/4), `displayValue` (3/19), `percentValue` (3/21), `showValue` (3/7), `state` (3/9), `width` (0/1) | - | - |
| sap.m.Image | 2 / 51 | `alt` (0/6), `decorative` (0/6), `densityAware` (0/15), `height` (1/11), `src` (2/49), `width` (1/26) | - | - |

### Input

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.Input | 87 / 117 | `description` (3/10), `editable` (7/1), `enabled` (17/1), `maxLength` (4/2), `placeholder` (14/39), `showClearIcon` (0/2), `showSuggestion` (1/12), `showValueHelp` (8/8), `type` (8/41), `value` (81/96), `valueLiveUpdate` (0/6), `valueState` (1/6), `valueStateText` (1/6), `width` (12/26) | `suggestionItems` (1/10) | `change` (0/10), `liveChange` (1/7), `submit` (12/1), `suggestionItemSelected` (0/3), `valueHelpRequest` (4/8) |
| sap.m.TextArea | 12 / 17 | `editable` (6/0), `growing` (3/1), `growingMaxLines` (2/1), `maxLength` (0/3), `placeholder` (3/8), `rows` (9/11), `showExceededText` (0/1), `value` (11/13), `valueLiveUpdate` (2/3), `valueState` (0/2), `width` (10/8), `wrapping` (1/0) | - | `liveChange` (0/1) |
| sap.ui.core.Item | 12 / 132 | `key` (12/127), `text` (11/131) | - | - |
| sap.m.CheckBox | 11 / 36 | `editable` (1/0), `enabled` (5/3), `partiallySelected` (0/2), `required` (0/1), `selected` (9/29), `text` (2/23), `valueState` (0/1), `wrapping` (0/1) | - | `select` (2/11) |
| sap.m.Switch | 10 / 24 | `customTextOff` (1/2), `customTextOn` (1/2), `enabled` (3/2), `state` (10/23), `type` (1/4) | - | `change` (8/5) |
| sap.m.SegmentedButton | 10 / 23 | `enabled` (0/1), `selectedKey` (9/16), `width` (0/5) | `items` (10/23) | `selectionChange` (4/9) |
| sap.m.SegmentedButtonItem | 10 / 23 | `enabled` (0/2), `icon` (4/13), `key` (10/16), `text` (10/18), `width` (0/2) | - | - |
| sap.m.Select | 8 / 85 | `editable` (1/2), `enabled` (1/1), `forceSelection` (3/9), `selectedKey` (7/80), `valueState` (0/1), `valueStateText` (0/1), `width` (2/11) | - (default: `items`) | `change` (1/11), `liveChange` (0/1) |
| sap.m.DatePicker | 8 / 23 | `dateValue` (2/0), `displayFormat` (3/7), `editable` (2/0), `placeholder` (1/2), `required` (0/3), `value` (4/16), `valueFormat` (6/6), `valueState` (0/4), `valueStateText` (0/4), `width` (0/4) | - | `change` (0/4) |
| sap.m.SearchField | 7 / 29 | `placeholder` (7/8), `showRefreshButton` (0/2), `value` (5/6), `width` (7/27) | - | `liveChange` (2/3), `search` (5/15), `suggest` (0/1) |
| sap.m.ComboBox | 3 / 36 | `placeholder` (0/10), `selectedKey` (3/16), `showClearIcon` (0/2), `value` (0/8), `valueState` (0/3), `valueStateText` (0/3), `width` (0/5) | - (default: `items`) | `change` (0/4) |
| sap.m.MultiInput | 3 / 14 | `enabled` (1/0), `placeholder` (0/6), `showSuggestion` (0/9), `showValueHelp` (0/11), `value` (0/4), `valueState` (0/2), `width` (1/9) | `tokens` (3/6) (default: `suggestionItems`) | `change` (0/2), `tokenUpdate` (0/2), `valueHelpRequest` (1/1) |
| sap.m.Token | 3 / 12 | `editable` (3/0), `key` (3/9), `selected` (3/0), `text` (3/12) | - | - |
| sap.m.MultiComboBox | 2 / 21 | `editable` (1/0), `placeholder` (0/7), `selectedKeys` (1/8), `valueState` (0/2), `valueStateText` (0/2), `width` (0/14) | - (default: `items`) | `selectionChange` (0/3), `selectionFinish` (0/8) |
| sap.m.StepInput | 2 / 4 | `displayValuePrecision` (0/1), `editable` (0/1), `enabled` (0/1), `max` (0/2), `min` (1/2), `step` (0/2), `value` (2/4), `valueState` (0/2), `width` (0/4) | - | `change` (0/1) |
| sap.ui.core.ListItem | 1 / 19 | `additionalText` (1/11), `key` (0/18), `text` (1/19) | - | - |
| sap.m.DateTimePicker | 1 / 10 | `dateValue` (1/0), `displayFormat` (0/3), `editable` (1/0), `placeholder` (0/2), `required` (0/3), `value` (0/7), `valueFormat` (0/6), `valueState` (0/4), `valueStateText` (0/3), `width` (0/2) | - | `change` (0/4) |

### Actions

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.Button | 169 / 273 | `ariaHasPopup` (0/30), `enabled` (8/33), `icon` (59/93), `text` (149/242), `type` (83/136), `width` (4/20) | - | `press` (167/215) |
| sap.m.ToggleButton | 1 / 43 | `enabled` (0/1), `icon` (1/15), `pressed` (1/24), `text` (1/31), `type` (0/1) | - | `press` (1/10) |

### Collections & tables

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.Column | 65 / 69 | `demandPopin` (2/50), `hAlign` (3/56), `importance` (0/1), `mergeDuplicates` (2/2), `minScreenWidth` (2/49), `width` (8/48) | - (default: `header`) | - |
| sap.m.ColumnListItem | 65 / 69 | `selected` (10/8), `type` (8/18), `vAlign` (8/29) | - (default: `cells`) | `detailPress` (1/0), `press` (7/6) |
| sap.m.Table | 63 / 63 | `alternateRowColors` (0/1), `growing` (13/8), `growingScrollToLoad` (3/1), `growingThreshold` (5/3), `headerText` (10/12), `inset` (0/29), `mode` (11/17), `noDataText` (2/3), `popinLayout` (0/8), `sticky` (4/8), `width` (6/16) | `columns` (63/62), `headerToolbar` (38/39), `infoToolbar` (0/11) (default: `items`) | `itemPress` (0/5), `selectionChange` (0/5) |
| sap.m.List | 24 / 74 | `growing` (0/6), `growingThreshold` (0/4), `headerText` (15/35), `includeItemInSelection` (0/5), `mode` (7/13), `noDataText` (5/7), `showSeparators` (3/9), `width` (1/4) | `headerToolbar` (0/10) (default: `items`) | `delete` (0/4), `itemPress` (0/1), `selectionChange` (7/5) |
| sap.m.StandardListItem | 18 / 59 | `counter` (0/7), `description` (14/39), `highlight` (1/5), `icon` (6/33), `iconDensityAware` (0/29), `iconInset` (1/31), `info` (9/9), `infoState` (1/5), `selected` (6/3), `title` (18/59), `type` (1/17), `wrapping` (2/1) | - (default: `actions`) | `detailPress` (1/1), `press` (0/7) |
| sap.m.CustomListItem | 5 / 7 | `selected` (1/0) | - (default: `content`) | - |
| sap.m.Tree | 4 / 9 | `headerText` (4/0), `mode` (0/4), `sticky` (0/1) | `headerToolbar` (0/3) (default: `items`) | `toggleOpenState` (0/1) |
| sap.m.StandardTreeItem | 3 / 8 | `icon` (0/1), `title` (3/8) | - | - |

### Dialogs & popups

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.Dialog | 46 / 33 | `contentHeight` (10/5), `contentWidth` (23/8), `draggable` (4/2), `horizontalScrolling` (1/0), `icon` (3/0), `resizable` (5/3), `showHeader` (0/1), `state` (1/1), `stretch` (5/0), `title` (20/26), `type` (1/9), `verticalScrolling` (3/3) | `beginButton` (2/27), `buttons` (38/3), `customHeader` (0/2), `endButton` (3/21), `footer` (0/1), `subHeader` (0/1) (default: `content`) | `afterClose` (30/0) |
| sap.m.Popover | 7 / 12 | `contentHeight` (0/3), `contentWidth` (5/6), `modal` (0/1), `placement` (7/10), `showHeader` (0/6), `title` (7/5) | `footer` (2/4) (default: `content`) | `afterClose` (0/1) |

### Messages

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.m.MessageStrip | 153 / 45 | `enableFormattedText` (1/1), `showCloseButton` (0/7), `showIcon` (145/27), `text` (150/45), `type` (152/27) | - | `close` (0/1) |

### Tolerated (no visual)

| Control | Core / samples-controls apps | Properties | Aggregations | Events |
|---|---:|---|---|---|
| sap.ui.core.CustomData *(tolerated)* | 3 / 11 | `key` (3/11), `value` (3/10), `writeToDom` (2/4) | - | - |
| sap.m.FlexItemData *(tolerated)* | 1 / 37 | `baseSize` (1/6), `growFactor` (1/29), `shrinkFactor` (0/8) | - | - |
| sap.ui.layout.GridData *(tolerated)* | 0 / 37 | `linebreak` (0/11), `span` (0/36) | - | - |
| sap.m.OverflowToolbarLayoutData *(tolerated)* | 0 / 18 | `priority` (0/18) | - | - |

<!-- portable:controls:end -->

## 4. Binding forms

Property values are strings in the view XML; `{` starts a binding unless it
is escaped as `\{`.

| Form | Example | Core apps (samples-controls) | v1 |
|---|---|---:|---|
| absolute path | `{/MV_VALUE}`, `{/S_SCREEN/COLOR_01}` | 160 (421) | MUST - **two-way** for value-like properties (`Input.value`, `CheckBox.selected`, `Switch.state`, `Select.selectedKey`, `SegmentedButton.selectedKey`, `ColumnListItem.selected`, ...): the frontend writes user edits into the model and sends them as the model delta of the next event ([../spec/request.md](../spec/request.md#the-model-delta)) |
| list binding of an aggregation | `items="{/T_TAB}"` + one template child | 133 (387) | MUST - the template is cloned per array entry; relative paths resolve per entry |
| relative path | `{TITLE}` | 91 (312) | MUST - inside a template or an element binding |
| object binding | `{path:'/T_TAB', templateShareable:false}` | 15 (202) | MUST for the keys `path`, `parts`, `type`, `formatOptions`, `constraints`, `formatter` (below), `targetType`, `mode`; list bindings: `path`, `sorter: {path, descending}`, `templateShareable` (no effect), `length`, `startIndex` |
| string composite | `{/MV_PERCENT} %` | 11 (97) | MUST - concatenate the formatted parts |
| expression binding | `{= ${/QUANTITY} > 500 }` | 11 (138) | MUST for the restricted grammar below; anything else is outside the profile |
| escaped braces | `.c \{ color:red \}` | 9 (52) | MUST - unescape |
| typed binding | `{path:'/AMOUNT', type:'sap.ui.model.type.Integer'}` | 3 (89) | MUST for `sap.ui.model.type.` String, Integer, Float, Currency (with `parts: [amount, currency]`), Date, Time, DateTime; the formatOptions and constraints below; a parse error sets the control's value state to error |
| composite `parts` | `{parts:['/AMOUNT','/CURRENCY'], type:...}` | 3 (62) | MUST, with a v1 type or a v1 formatter |
| frontend formatters | `formatter: 'Formatter.DateAbapDateToDateObject'` | 4 (36) | MUST for `Formatter.DateCreateObject`, `Formatter.DateAbapDateToDateObject`, `Formatter.DateAbapDateTimeToDateObject` (ABAP DATS/TIMS/ISO strings to dates) |
| `device>` model | `{device>/system/phone}` | 1 (2) | MUST - the frontend provides `/system/{phone,tablet,desktop}`, `/resize/{width,height}`, `/support/touch`, `/orientation/{portrait,landscape}` |
| other named models | `{L0>FNAME}`, `{meta>ENTITY}` | 6 (8) | **excluded** (XML templating and OData metadata) |
| `{i18n>key}` | - | 0 (0) | **excluded** (unused) |
| `sap.ui.model.odata.type.*` | - | 1 (1) | **excluded** |

- **formatOptions:** `minFractionDigits`, `maxFractionDigits`,
  `minIntegerDigits`, `maxIntegerDigits`, `groupingEnabled`, `decimals`,
  `style`, `pattern`, `source.pattern`, `showMeasure`, `showNumber`,
  `currencyCode`, `preserveDecimals`, `UTC`.
- **constraints:** `minimum`, `maximum`, `minLength`, `maxLength`.
- **Expression grammar (restricted).** References `${/absolute}`,
  `${relative}`, `${device>/path}`; string, number, boolean and `null`
  literals; the operators `! && || ?: === !== == != < <= > >= + - * / %` and
  parentheses; the member `.length`; the functions `Math.max`, `Math.min`,
  `Math.abs`, `Math.round`, `Math.floor`, `Math.ceil` and the string methods
  `.toUpperCase()`, `.toLowerCase()`, `.trim()`, `.indexOf()`,
  `.includes()`, `.startsWith()`. Everything else - RegExp, `odata.*`,
  `encodeURIComponent`, arbitrary JavaScript - is outside the profile (one
  core app uses such a call).
- A frontend MAY evaluate the bindings any way it likes; what counts is the
  value the control shows and the value the model receives.

## 5. Event wires and their arguments

The wire forms are those of the UI5 profile ([ui5.md](ui5.md#event-wires)),
written by the backend's `z2ui5_cl_ui5_srv_event` (abap2UI5
`src/01/02/z2ui5_cl_ui5_srv_event.clas.abap`, `get_event`,
`get_event_client`):

| Wire (in the attribute) | From | Wires in all corpora / core apps | v1 |
|---|---|---:|---|
| `.eB(['EVENT'])` | `client->_event( )` | 1,198 / 192 | MUST |
| `.eB(['EVENT'], arg1, ...)` | `client->_event( val t_arg )` | 579 | MUST, arguments per the descriptor table |
| `.eB(['___ZZZ_NAL'])` | `client->_event_nav_app_leave( )` | 198 / 180 | MUST - fires the reserved leave event ([../spec/navigation.md](../spec/navigation.md#the-reserved-leave-event)) |
| `.eF('ACTION', arg...)` | `_event_client( )`, a wired `follow_up_action( )` | 583 / 22 | MUST for the frontend actions of section 6, run on the event without a roundtrip |
| `.eBP($event, true, ['EVENT'], ...)` | `s_ctrl-check_prevent_default` | 18 | MUST - cancel the native default, then roundtrip |
| `.eBP($event, <expr>, ...)` | `s_ctrl-prevent_default_expr` | | **excluded** (an expression over control objects) |
| `['EVENT', false, false, false, queueLast, noBusy]` | `s_ctrl-check_queue_last`, `check_no_busy` | 37 / 31 | MUST - keep only the last firing while a roundtrip runs; no busy overlay |
| quoted arguments | `s_ctrl-check_arg_literal` | 1 | MUST - every argument is a string |

**Event-argument descriptors.** The arguments of `.eB(...)` are evaluated
when the event fires:

| Descriptor | Meaning | Core / samples-controls apps | v1 |
|---|---|---:|---|
| `'ROW_1'` | a constant | 15 / 150 | MUST |
| `${REL_PATH}`, e.g. `${ID}` | a field of the binding context (row) of the control that fired - how a table or list row identifies itself | 29 / 21 | MUST - evaluated in the clicked item's context |
| `${/ABS_PATH}` | the current model value | 2 / 1 | MUST |
| `${$source>/prop}` | a property of the control that fired | 4 / 22 | MUST for every v1 property of that control |
| `${$parameters>/name}` | an event parameter | 23 / 168 | MUST for the closed list below |
| JSON / message template starting with `{` or `$` | passed through as data | 5 / 13 | MUST (meaningful for frontend actions) |
| `${$parameters>/selectedItem}.getKey()`, `.getBindingContext().getPath()`, `.indexOfItem()` | UI5 object API | 9 / 114 | **excluded** - bind `selectedKey` / `selected` two-way or pass `${REL}` instead |
| `$event.getSource()...`, `$event.mParameters...` | the raw UI5 event | 7 / 83 | **excluded** |
| `$controller.slotValue( )`, `textPath( )` | frontend controller helpers | 1 / 0 | **excluded** |

**Event parameters** (`${$parameters>/name}`) a portable frontend MUST
provide:

| Control | Event | Parameters |
|---|---|---|
| sap.m.Input | `liveChange`, `submit`, `change` / `suggest` | `value` / `suggestValue` |
| sap.m.TextArea | `liveChange`, `change` | `value` |
| sap.m.SearchField | `search` / `liveChange` / `suggest` | `query`, `refreshButtonPressed` (false), `clearButtonPressed` (false) / `newValue` / `suggestValue` |
| sap.m.CheckBox | `select` | `selected` |
| sap.m.Switch | `change` | `state` |
| sap.m.ToggleButton | `press` | `pressed` |
| sap.m.IconTabBar | `select` | `key`, `selectedKey` |
| sap.m.DatePicker, sap.m.DateTimePicker | `change` | `value`, `valid` |
| sap.m.StepInput | `change` | `value` |
| sap.m.MultiInput | `change` / `tokenUpdate` | `value` / `type` |
| sap.m.MultiComboBox, sap.m.Table, sap.m.List | `selectionChange` | `selected` |
| sap.m.Panel | `expand` | `expand` |

Parameters that are UI5 objects (`item`, `listItem`, `selectedItem`,
`column`, `draggedControl`, ...) are excluded. The event names a frontend
fires are exactly the `events` lines of section 3.

## 6. Frontend actions

The follow-up actions of a response (`T_CUSTOM`,
[../spec/actions.md](../spec/actions.md)) and the `.eF(...)` wires a portable
frontend MUST perform:

| Action | Core apps | Notes |
|---|---:|---|
| `MESSAGE_TOAST show` | 53 (`message_toast_display`) + 6 | toast with `duration`, `onClose` |
| `MESSAGE_BOX show / alert / confirm / information / warning / error / success` | 45 (`message_box_display`) + 6 | dialog with type, text, title, actions, `onClose` event (the pressed action is its argument), details |
| `VIEW_SLOTS destroy POPUP / POPOVER` | 5 | the frontend close of `cs_event-popup_close` / `popover_close` |
| `SET_FOCUS` | 20 | focus the control with that id (optional selection start/end) |
| `START_TIMER` | 8 | fire the event after the delay |
| `DOWNLOAD_B64_FILE`, `CLIPBOARD_COPY`, `URLHELPER`, `OPEN_NEW_TAB` | 4, 4, 3, 2 | browser (or platform share/intent) APIs |
| `SCROLL_TO`, `SCROLL_INTO_VIEW` | 2, 1 | scroll the element with that id |
| `SET_TITLE`, `SET_FAVICON`, `LOCATION_RELOAD`, `SYSTEM_LOGOUT`, `STORE_DATA`, `KEYBOARD_SHORTCUT`, `PLAY_AUDIO` | 1-2 each | MAY be a no-op where the platform has no counterpart |
| `BUSY_INDICATOR show/hide`, `INVISIBLE_MESSAGE announce`, `THEMING setTheme` (via `CONTROL_GLOBAL`) | 3 | busy overlay, aria-live region, theme switch |
| `SET_PUSH_STATE`, `HASH_REPLACE`, `HASH_BACK`, `HASH_ATTACH_CHANGED`, `SET_NAV_ROUTING`, `SET_APP_STATE_ACTIVE` | 1-3 each | URL hash handling ([../spec/navigation.md](../spec/navigation.md)); MAY be a no-op without a URL (native) |
| `SET_SIZE_LIMIT` | 1 | a UI5 list limit - MAY be a no-op |

**Names on the client API and on the wire are not the same list**
(decided in revision 0.3,
[open question 10](../spec/open-questions.md#10-navigation-actions-in-the-portable-action-list)).
The table above names what a portable app may *call*. The navigation family
among them is folded by the backend into the one `ROUTER` system action
([../spec/actions.md](../spec/actions.md#vocabulary),
[../spec/navigation.md](../spec/navigation.md#the-router-action), [CL]
`follow_up_action`, [FE] `check_on_event`): a renderer never receives
`SET_PUSH_STATE`, `HASH_REPLACE`, `HASH_ATTACH_CHANGED`, `SET_NAV_ROUTING`
or `SET_APP_STATE_ACTIVE` - it receives `ROUTER` with options, and
`HASH_BACK` as a follow-up action. `portable-v1.json` says both:
`actions.api` (what an app may call; `frontendActions.allowed` is the same
list, kept for readers of revision 0.2) and `actions.wire` (what a renderer
implements):

<!-- portable:actions:begin - generated from portable-v1.json by scripts/render-portable.mjs, do not edit -->

| Client API (`actions.api`) | What the renderer receives (`actions.wire`) |
|---|---|
| `SET_FOCUS` | `SET_FOCUS` (`T_CUSTOM`, `.eF`) |
| `START_TIMER` | `START_TIMER` (`T_CUSTOM`, `.eF`) |
| `DOWNLOAD_B64_FILE` | `DOWNLOAD_B64_FILE` (`T_CUSTOM`, `.eF`) |
| `CLIPBOARD_COPY` | `CLIPBOARD_COPY` (`T_CUSTOM`, `.eF`) |
| `URLHELPER` | `URLHELPER` (`T_CUSTOM`, `.eF`) |
| `OPEN_NEW_TAB` | `OPEN_NEW_TAB` (`T_CUSTOM`, `.eF`) |
| `SCROLL_TO` | `SCROLL_TO` (`T_CUSTOM`, `.eF`) |
| `SCROLL_INTO_VIEW` | `SCROLL_INTO_VIEW` (`T_CUSTOM`, `.eF`) |
| `SET_TITLE` | `SET_TITLE` (`T_CUSTOM`, `.eF`) |
| `SET_FAVICON` | `SET_FAVICON` (`T_CUSTOM`, `.eF`) |
| `LOCATION_RELOAD` | `LOCATION_RELOAD` (`T_CUSTOM`, `.eF`) |
| `SYSTEM_LOGOUT` | `SYSTEM_LOGOUT` (`T_CUSTOM`, `.eF`) |
| `STORE_DATA` | `STORE_DATA` (`T_CUSTOM`, `.eF`) |
| `KEYBOARD_SHORTCUT` | `KEYBOARD_SHORTCUT` (`T_CUSTOM`, `.eF`) |
| `PLAY_AUDIO` | `PLAY_AUDIO` (`T_CUSTOM`, `.eF`) |
| `SET_PUSH_STATE` | the `ROUTER` option `setPushState` - never `SET_PUSH_STATE` itself |
| `HASH_REPLACE` | the `ROUTER` option `setHashReplace` - never `HASH_REPLACE` itself |
| `HASH_BACK` | `HASH_BACK` (`T_CUSTOM`, `.eF`) |
| `HASH_ATTACH_CHANGED` | the `ROUTER` option `setHashEvent` - never `HASH_ATTACH_CHANGED` itself |
| `SET_NAV_ROUTING` | the `ROUTER` option `setNavRouting` - never `SET_NAV_ROUTING` itself |
| `SET_APP_STATE_ACTIVE` | the `ROUTER` option `setAppStateActive` - never `SET_APP_STATE_ACTIVE` itself |
| `SET_SIZE_LIMIT` | `SET_SIZE_LIMIT` (`T_CUSTOM`, `.eF`) |
| (`MESSAGE_TOAST`) | `MESSAGE_TOAST` show (`T_CUSTOM` or `.eF`, directly or as a `CONTROL_GLOBAL` target) |
| (`MESSAGE_BOX`) | `MESSAGE_BOX` show / alert / confirm / information / warning / error / success (`T_CUSTOM` or `.eF`, directly or as a `CONTROL_GLOBAL` target) |
| (`BUSY_INDICATOR`) | `BUSY_INDICATOR` show / hide (`T_CUSTOM` or `.eF`, directly or as a `CONTROL_GLOBAL` target) |
| (`INVISIBLE_MESSAGE`) | `INVISIBLE_MESSAGE` announce (`T_CUSTOM` or `.eF`, directly or as a `CONTROL_GLOBAL` target) |
| (`THEMING`) | `THEMING` setTheme (`T_CUSTOM` or `.eF`, directly or as a `CONTROL_GLOBAL` target) |
| (`VIEW_SLOTS`) | `VIEW_SLOTS` destroy (`T_CUSTOM` or `.eF`, directly or as a `CONTROL_GLOBAL` target) |

System actions (`T_SYSTEM`): `VIEW_SLOTS` display / destroy, `ROUTER` sync; the `ROUTER` options: `setNavRouting`, `checkNavAppCall`, `navAppCallPrevApp`, `navAppCallPrevId`, `setPushState`, `setHashReplace`, `setHashEvent`, `setAppStateActive`. MAY be a no-op where the platform has no counterpart: `ROUTER`, `HASH_BACK`, `SET_SIZE_LIMIT`.

<!-- portable:actions:end -->

**Excluded:** `CONTROL_BY_ID` (open-ended UI5 method calls, 16 core apps;
a closed whitelist is a v1.1 candidate), `BINDING_CALL` (v1.1 candidate),
`BIND_ELEMENT`, `SET_ODATA_MODEL`, `SMART_VARIANT_INIT`,
`FILTER_BAR_VARIANT_INIT`, `CROSS_APP_NAV_TO_EXT`, `CROSS_APP_NAV_TO_PREV_APP`,
`SET_TITLE_LAUNCHPAD`, and the `CONTROL_GLOBAL` targets `ICON_POOL`, `POPUP`,
`FORMATTING`.

**Client API of a portable app** (backend side): `view_display`,
`popup_display` / `popup_destroy`, `popover_display` / `popover_destroy`,
`message_toast_display`, `message_box_display`, `follow_up_action` (the
actions above), `_event`, `_event_client`, `_event_nav_app_leave`, `_bind`;
`nav_app_call` / `nav_app_leave` and `get_event_arg` are server-side and
transparent to the frontend. Not in v1: `nest_view_display` /
`nest2_view_display`, `view_display( switch_default_model_path )`.

## 7. Explicit exclusions

- **Namespaces and families:** `sap.ui.comp` (smart controls), `sap.uxap`,
  `sap.f` (DynamicPage and FlexibleColumnLayout are v1.1 candidates),
  `sap.ui.table` (v1.1 candidate), `sap.ui.unified`, `sap.suite.*`,
  `sap.viz`, `sap.gantt`, `sap.ui.vbm`, `sap.ui.vk`, `sap.ui.codeeditor`,
  `sap.ui.integration`, `sap.ndc`, `sap.ui.webc.*`, drag and drop
  (`sap.ui.core.dnd`, `sap.f.dnd`), `sap.m.plugins`, and `html:` elements
  in a view (use `core:HTML`).
- **abap2UI5 custom controls `z2ui5.cc.*`** (19 core apps): frontend
  extensions bound to the UI5 runtime. Several are device or browser
  services that map well to other platforms; each needs a portable spec of
  its own and is not part of the view profile.
- **XML templating** (`template:if/repeat/with`).
- **UI5 object access** in event arguments, `prevent_default_expr`, named
  models other than `device`, `odata.*` types, app formatter functions,
  `core:require`, i18n models.
- **Members** not listed in section 3 (Table `inset` is listed, `popinLayout`
  too; Column `popinDisplay`, ComboBox `showSecondaryValues`, Input
  `suggestionColumns`, Image `mode`, ... are not) - ignored by a portable
  frontend, never an error.

## 8. Rules for frontends that fall out of the census (SHOULD)

1. **Two-way binding is how a portable app reads UI state** - 81 core apps
   bind `Input.value`, 10 `Switch.state`, 10 `ColumnListItem.selected`, 9
   `CheckBox.selected`, 9 `SegmentedButton.selectedKey`. The frontend keeps
   the model in sync and sends the changed paths with the next event, as
   the UI5 frontend does; this replaces every `.getKey()` / `$event`
   construct.
2. **Row identity comes from the binding context:** `${REL}` arguments and
   `press` wires of list items are evaluated against the clicked row.
3. **Back navigation is everywhere** (`showNavButton` +
   `navButtonPress=_event_nav_app_leave( )`, 185 core apps): implement the
   Page header first.
4. **Popups are common** (Dialog in 46 core apps); popovers need stable ids
   for their anchor.
5. **Messages:** MessageStrip (153 core apps), toast (53), message box (45) -
   all three belong in a first renderer.
6. **Forms are SimpleForm** (70 core apps) with a flat Label/field
   sequence that the frontend has to group (Appendix A).
7. **Tables are `sap.m.Table`** (63 core apps) with `ColumnListItem`
   templates; growing is local paging over rows already in the model.

## 9. v1.1 candidates (informative)

Ordered by core apps they would unblock; taking all of them lifts control
coverage from 73.7 % to 82.6 % of core apps. None of them is part of v1.

<!-- portable:v11:begin - generated from portable-v1.json by scripts/render-portable.mjs, do not edit -->

| Family | Controls | Core apps blocked in v1 | Web Component | Fit / note |
|---|---|---:|---|---|
| grid table | sap.ui.table.Table, Column, RowAction, RowActionItem | 7 | ui5-table (+ ui5-table-row-action, ui5-table-virtualizer) | adapt: Column `label` + `template` instead of header/cells; `visibleRowCount`/`selectionMode`/`rowActionTemplate`; fixed columns and column menu (`sort`/`filter` events with `$parameters>/column` objects) not portable |
| message popover | sap.m.MessagePopover, MessageItem, MessageView | 4 (3 sole) | none - compose ui5-popover/ui5-dialog + ui5-list (ui5-li with highlight per type) | compose |
| page layouts | sap.f.DynamicPage (+Title, Header), sap.f.FlexibleColumnLayout, sap.m.NavContainer | 3 + 3 + 3 | ui5-dynamic-page/-title/-header, ui5-flexible-column-layout | adapt; NavContainer needs CONTROL_BY_ID `to`/`back` -> define a portable "page switch" |
| value-help dialogs | sap.m.TableSelectDialog, SelectDialog | 3 (2 sole) | none - compose ui5-dialog + ui5-input search + ui5-table/ui5-list | compose; `search`/`confirm` events with `$parameters>/value`, selected rows via two-way `selected` |
| quick view | sap.m.QuickView, QuickViewPage, QuickViewGroup, QuickViewGroupElement | 3 | none - compose ui5-popover | compose |
| menus | sap.m.Menu, MenuItem, MenuButton | 2 | ui5-menu, ui5-menu-item, ui5-button opener | direct |
| small inputs | TimePicker, Slider, RadioButton/RadioButtonGroup, RatingIndicator | 1 each (+ many in samples-controls: Slider 37, RadioButton 15) | ui5-time-picker, ui5-slider, ui5-radio-button (group via name), ui5-rating-indicator | direct |
| object display | ObjectAttribute, ObjectHeader, Avatar, FormattedText, Carousel, Breadcrumbs | 1 each (samples-controls: 43, 26, 40, …) | compose / ui5-avatar / limited HTML / ui5-carousel / ui5-breadcrumbs | mixed |
| full Form | sap.ui.layout.form.Form, FormContainer, FormElement (+ ResponsiveGridLayout) | 0 (18 samples-controls) | ui5-form, ui5-form-group, ui5-form-item | direct (simpler than SimpleForm) |
| ResponsivePopover | sap.m.ResponsivePopover | 0 (18) | ui5-responsive-popover | direct |
| nested views | `nest_view_display`, `nest2_view_display` | 3 (+3 with other blockers) | render a second view document into the control with the given id | protocol feature, no new control |
| CONTROL_BY_ID whitelist | `open`/`close`/`openBy`/`toggleBy` (Dialog, Popover), `setExpanded` (Panel), `focus`, `addStyleClass`/`removeStyleClass`/`toggleStyleClass`, `setText`, `setVisible` | 5 among v1-control-covered apps (16 overall) | renderer implements the named methods on its own components | defines the portable part of an open-ended action |
| BINDING_CALL | client-side `filter`/`sort` of a bound list | 2 | renderer-side filter/sort of the template rows | needs a declarative filter/sort spec |

<!-- portable:v11:end -->

## 10. Method and caveats

The list is drawn from a census of every app in the sample corpora,
run on 2026-10-03:

- **Corpora.** The *core corpus* (247 apps with a view) is abap2UI5/samples
  (138), abap2UI5/samples-stack (32) and addon and real-world apps (77:
  popups, selection-screen, sapgui, abap-cloud-gui, admin-cockpit, agent).
  abap2UI5/samples-controls (642 ports of the UI5 demo kit) is reported
  separately: it is built to show every control, so it is a stress test, not
  a usage sample, and it has no knee in its coverage curve.
- **Reconstruction, not regex.** The exact view XML of every document of
  every class (main view, popups, popovers, fragments) comes from the
  abap2UI5 linter's view reconstruction (`prepareAbap( )` of
  `@abap2ui5/linter` 0.8.5), patched in one place so event-handler
  expressions (`_event`, `_event_client`, `follow_up_action`,
  `_event_nav_app_leave`) keep the raw ABAP call and wire shapes, arguments
  and frontend actions can be classified. Members are classified as
  property / event / aggregation / association from the linter's UI5
  metadata snapshot, with inheritance. Client API calls and
  `follow_up_action( )` call sites come from a scan of the ABAP source with
  comments and literals blanked.
- **"Fully covered"** means every control an app uses, in any of its
  documents, is in the set; "runs unchanged" adds members, binding forms,
  argument descriptors, frontend actions and client API.
- **Caveats.** 20 addon launcher classes built with the legacy
  `z2ui5_cl_xml_view` API are not replayed (their popups are counted); 6
  addon classes reconstruct only partly (what was found counts); argument
  classification of variables built at runtime is approximate; an older
  duplicate of abap-cloud-gui is not counted twice.
- **Reproduce.** The census scripts are in
  [`../tools/portable-census/`](../tools/portable-census/README.md), as they
  were run; `portable-v1.json` is regenerated from the census proposal with
  `node scripts/gen-portable-profile.mjs <portable-proposal.md>` and this
  page's generated sections with `node scripts/render-portable.mjs`
  (`npm test` fails when the two are out of step).

## Appendix A. UI5 Web Components mapping (informative)

How each v1 control maps to UI5 Web Components 2.x (`@ui5/webcomponents`,
`@ui5/webcomponents-fiori`; tag, attribute, slot and event names checked
against the 2.27.2 `custom-elements.json` manifests). *direct*: one
component, names translate 1:1; *adapt*: a component exists, structure,
values or events need translating; *compose*: no component, built from
HTML/CSS or several components.

<!-- portable:mapping:begin - generated from portable-v1.json by scripts/render-portable.mjs, do not edit -->

### Layout & containers

- **sap.m.Page** -> ui5-page (fiori) + ui5-bar in slot header/footer (*adapt*). `ui5-page` has no title/nav button: build the header as `<ui5-bar slot="header">` with `startContent` = `<ui5-button icon="nav-back" design="Transparent">` (only when `showNavButton`), default slot = `<ui5-title>` with `title`, `endContent` = `headerContent`. `customHeader` replaces that bar; `subHeader` = a second bar; `footer` (a Toolbar/OverflowToolbar/Bar) -> slot `footer` (`fixed-footer`). `showHeader=false` drops the bar, `enableScrolling=false` -> `no-scrolling`, `backgroundDesign` -> `background-design`. `navButtonPress` = click of the nav button.
  Not in v1: aggregation `landmarkInfo` (0/1).
- **sap.m.Shell** -> (none) - plain root <div> (*compose*). App frame only. Render its single child full-height; `appWidthLimited` (default true) = centred max-width (~1280px) letterbox. Do NOT map to `ui5-shellbar` (that is a header bar, not a frame).
  Not in v1: property `appWidthLimited` (0/1).
- **sap.m.VBox** -> (none) - <div style="display:flex;flex-direction:column"> (*compose*). `alignItems`/`justifyContent`/`wrap`/`width`/`height` are CSS flexbox one-to-one (Start->flex-start, End->flex-end, Center, Stretch, SpaceBetween->space-between, …). `renderType` ignored.
  Not in v1: property `fitContainer` (0/4), property `backgroundDesign` (0/1).
- **sap.ui.layout.form.SimpleForm** -> ui5-form + ui5-form-group + ui5-form-item (*adapt*). SimpleForm content is a FLAT sequence; the renderer must group it: a `core:Title` (or `Toolbar`/`Title`) opens a new `<ui5-form-group header-text>`; each `Label` opens a new `<ui5-form-item>` (the label goes to slot `labelContent`) and every following field until the next Label/Title goes to the item's default slot. `labelSpanXL/L/M/S` -> `label-span="S12 M4 L4 XL4"` (same notation), `emptySpan*` -> `empty-span`, `columnsXL/L/M` -> `layout="S1 M1 L2 XL2"`, `title` aggregation -> `header-text`. `layout`/`adjustLabelSpan`/`singleContainerFullSize`/`maxContainerCols` ignored. `editable` only changes label/field density in UI5 - no WC counterpart (ignore).
  Not in v1: property `backgroundDesign` (0/5), aggregation `toolbar` (0/3), event `validateFieldGroup` (0/1).
- **sap.m.HBox** -> (none) - <div style="display:flex"> (*compose*). As VBox, row direction. `wrap="Wrap"` -> `flex-wrap:wrap`.
  Not in v1: property `backgroundDesign` (0/2), property `fitContainer` (0/1).
- **sap.m.Panel** -> ui5-panel (*adapt*). `headerText` -> `header-text`; UI5 panels are NOT collapsible by default, WC panels are: set `fixed` unless `expandable=true`; `expanded` -> `!collapsed`; `headerToolbar` -> slot `header`; `width`/`height` CSS; `expand` <- `toggle` (`$parameters>/expand` = `!collapsed`). `backgroundDesign` -> CSS only.
  Not in v1: property `accessibleRole` (0/2).
- **sap.ui.layout.Grid** -> (none) - CSS grid, 12 columns (*compose*). `defaultSpan="XL3 L3 M6 S12"` -> per-breakpoint `grid-column: span n` (UI5 breakpoints S<600, M<1024, L<1440, XL); children may carry `GridData span/linebreak/indent` (tolerated). `hSpacing`/`vSpacing` (rem) -> `column-gap`/`row-gap`.
  Not in v1: property `containerQuery` (0/3), property `defaultIndent` (0/2), property `vSpacing` (0/5), property `position` (0/1).
- **sap.m.FlexBox** -> (none) - flex <div> (*compose*). `direction` (Row/Column/RowReverse/ColumnReverse) -> `flex-direction`; `fitContainer` -> height:100%; `gap`/`rowGap`/`columnGap` -> CSS gap.
- **sap.m.ScrollContainer** -> (none) - <div style="overflow:auto"> (*compose*). `vertical`/`horizontal` -> `overflow-y`/`overflow-x` (UI5 default: horizontal true, vertical false); `width`/`height` CSS. SCROLL_TO / SCROLL_INTO_VIEW actions address it by id.
  Not in v1: property `focusable` (0/2).
- **sap.m.IconTabFilter** -> ui5-tab (*adapt*). `text`, `icon` (sap-icon://x -> `icon="x"`), `key` -> keep as `data-key` (WC tabs have no key), `count` -> `additional-text`, `enabled=false` -> `disabled`, `design` -> `design`, content -> default slot. `iconColor` (Positive/Critical/Negative) -> tab `design`.
  Not in v1: property `showAll` (0/7), aggregation `items` (0/5), property `interactionMode` (0/3).
- **sap.m.IconTabBar** -> ui5-tabcontainer (*adapt*). `items` -> tabs; `selectedKey` (two-way) -> `selected` on the tab whose key matches, written back on `tab-select`; `select` <- `tab-select` with `$parameters>/key` and `$parameters>/selectedKey` = the tab's key; `expandable`/`expanded` -> `collapsed`; `headerBackgroundDesign` -> `header-background-design`. The IconTabBar-level `content` aggregation (shared content) has no slot: render it below the tab strip.
  Not in v1: property `backgroundDesign` (0/2), property `stretchContentHeight` (0/2), property `upperCase` (0/5), property `enableTabReordering` (0/3), property `tabDensityMode` (0/2), property `tabsOverflowMode` (0/1), property `maxNestingLevel` (0/1).
- **sap.ui.layout.VerticalLayout** -> (none) - block <div> (*compose*). Children stacked; `width` CSS.
- **sap.ui.core.Title** -> group header of ui5-form-group (inside forms); ui5-title elsewhere (*adapt*). Only `text` is used (and `level`). Inside SimpleForm it is a group separator, not a visible control of its own.
- **sap.ui.layout.HorizontalLayout** -> (none) - inline-flex <div> (*compose*). `allowWrapping` -> `flex-wrap`.

### Toolbars & bars

- **sap.m.OverflowToolbar** -> ui5-toolbar (*adapt*). Toolbar children must be toolbar items: Button/OverflowToolbarButton -> `ui5-toolbar-button`, ToolbarSpacer -> `ui5-toolbar-spacer`, Select -> `ui5-toolbar-select`/`ui5-toolbar-select-option`, anything else (Title, Label, Input, SearchField, SegmentedButton, …) wrapped in `ui5-toolbar-item`. `style="Clear"`/`design="Transparent"` -> `design="Transparent"`. `OverflowToolbarLayoutData priority` -> `overflow-priority` (NeverOverflow -> `NeverOverflow`, AlwaysOverflow -> `AlwaysOverflow`).
  Not in v1: property `active` (0/3), event `press` (0/3), property `design` (0/4), property `enabled` (0/1), property `width` (0/5), property `ariaHasPopup` (0/1).
- **sap.m.ToolbarSpacer** -> ui5-toolbar-spacer (*direct*). `width` -> `width` (fixed spacer); without width it is the flexible spacer. Outside a `ui5-toolbar` (e.g. in `ui5-bar`) use a `flex:1` div.
- **sap.m.Toolbar** -> ui5-toolbar (or ui5-bar) (*adapt*). Same mapping as OverflowToolbar. Most uses are the `headerToolbar` of a Table/List/Panel (Title + Spacer + Buttons).
  Not in v1: property `width` (0/1), property `design` (0/1), property `active` (0/1).
- **sap.m.Bar** -> ui5-bar (*direct*). `contentLeft` -> slot `startContent`, `contentMiddle` -> default slot, `contentRight` -> slot `endContent`; `design` (Header/SubHeader/Footer) -> `design`.
- **sap.m.OverflowToolbarButton** -> ui5-toolbar-button (*direct*). Icon-only in the bar, text shown in the overflow -> `show-overflow-text` + `text`; `type` -> `design` (as Button); `press` <- `click`.

### Display

- **sap.m.Text** -> ui5-text (*direct*). `text` -> text content; `wrapping=false` -> `max-lines="1"`; `maxLines` -> `max-lines`; `renderWhitespace` -> CSS `white-space:pre-wrap`; `emptyIndicatorMode` -> `empty-indicator-mode`; `textAlign`/`width` CSS.
- **sap.m.Label** -> ui5-label (*direct*). `text`, `required`, `showColon` -> `show-colon`, `wrapping` -> `wrapping-type`, `labelFor` -> `for` (needs the target's DOM id); `design="Bold"`/`width`/`textAlign` CSS.
  Not in v1: property `displayOnly` (0/2), property `wrappingType` (0/1).
- **sap.m.Title** -> ui5-title (*direct*). `text` -> text content; `level` (H1..H6, Auto) -> `level`; `titleStyle` -> `size`; `wrapping=true` -> `wrapping-type="Normal"`. A Title with a `content` child (link) renders that child inside.
  Not in v1: property `wrappingType` (0/1).
- **sap.m.ObjectStatus** -> ui5-tag (non-interactive) or styled text (*adapt*). No exact counterpart. `state` None/Success/Warning/Error/Information/IndicationNN -> `ui5-tag design` Neutral/Positive/Critical/Negative/Information/Set1..(color-scheme) - BUT a tag renders as a pill; apps expect coloured text (+ icon). Recommended: `<span>` with theming colour vars (`--sapPositiveTextColor`, …) + optional `ui5-icon`; use `ui5-tag` only for `inverted=true`. `title` -> "title: " prefix; `active`/`press` -> `ui5-tag interactive` + `click`.
- **sap.m.Link** -> ui5-link (*direct*). `text` -> text content, `href`, `target`, `enabled=false` -> `disabled`, `emphasized` -> `design="Emphasized"`, `subtle` -> `design="Subtle"`, `wrapping` -> `wrapping-type`, `icon`/`endIcon` -> `icon`/`end-icon`; `press` <- `click` (do not navigate when a press wire is set and no href).
  Not in v1: property `subtle` (0/1), property `ariaHasPopup` (0/5).
- **sap.m.ObjectIdentifier** -> (none) - ui5-title/ui5-link + ui5-text (*compose*). Two lines: `title` (bold; `ui5-link` when `titleActive`, firing `titlePress`) and `text` (secondary).
- **sap.ui.core.HTML** -> (none) - raw HTML in a <div> (*compose*). `content` is injected as HTML. Used for (a) custom `<style>` blocks (CSS classes for `class=` attributes - note selectors written against UI5 DOM such as `.sapMInputBaseInner` will not match WC shadow DOM) and (b) small static markup. Must be sanitized/CSP-checked by the renderer (`sanitizeContent`).
- **sap.ui.core.Icon** -> ui5-icon (*adapt*). `src="sap-icon://name"` -> `name="name"` (icon names are shared with `@ui5/webcomponents-icons`; `sap-icon://tnt/...`/`businessSuiteInAppSymbols/...` -> `tnt/...`/`business-suite/...` and the matching icon package); `size` -> CSS `font-size`/width/height; `color` -> CSS colour or semantic (`Positive`/`Negative`/`Critical`/`Neutral`) -> `design`; `press` -> `mode="Interactive"` + `click`; `alt` -> `accessible-name`.
- **sap.m.ObjectNumber** -> (none) - composed <span> (*compose*). `number` + `unit` (unit in smaller text), `emphasized` -> bold, `state` -> theming colour var as ObjectStatus, `textAlign` CSS. Number formatting comes from the binding type, not the control.
  Not in v1: property `active` (0/1), property `inverted` (0/1), event `press` (0/1), property `textAlign` (0/1).
- **sap.tnt.InfoLabel** -> ui5-tag (*direct*). `text` -> text content, `colorScheme` 1..10 -> `color-scheme`, `icon` -> `<ui5-icon slot="icon">`, `displayOnly` -> no padding (CSS); `design="Set2"` style default.
  Not in v1: property `displayOnly` (0/2), property `renderMode` (0/1), property `width` (0/1).
- **sap.m.ProgressIndicator** -> ui5-progress-indicator (*direct*). `percentValue` -> `value`, `displayValue` -> `display-value`, `showValue=false` -> `hide-value`, `state` Success/Error/Warning/Information -> `value-state` Positive/Negative/Critical/Information, `width` CSS.
  Not in v1: property `displayAnimation` (0/2).
- **sap.m.Image** -> (none) - <img> (*compose*). `src`, `width`, `height`, `alt`, `decorative` -> `alt=""`; `densityAware` ignored. (`ui5-avatar` only for avatar-like images.)
  Not in v1: property `backgroundPosition` (0/1), property `backgroundRepeat` (0/1), property `backgroundSize` (0/1), property `mode` (0/2), aggregation `detailBox` (0/2), event `press` (0/5), event `error` (0/1), event `load` (0/1).

### Input

- **sap.m.Input** -> ui5-input (*adapt*). `value` (two-way: update model on `change`, and on `input` when `valueLiveUpdate=true`), `placeholder`, `enabled=false` -> `disabled`, `editable=false` -> `readonly`, `type` Text/Email/Number/Password/Tel/Url -> `type` (Url -> URL), `maxLength` -> `maxlength`, `required`, `showClearIcon` -> `show-clear-icon`, `valueState` None/Error/Warning/Success/Information -> None/Negative/Critical/Positive/Information, `valueStateText` -> `<div slot="valueStateMessage">`, `width` CSS. `showValueHelp` -> `<ui5-icon slot="icon" name="value-help" mode="Interactive">` whose click fires `valueHelpRequest`. `showSuggestion` + `suggestionItems` (core:Item/ListItem) -> `show-suggestions` + `ui5-suggestion-item text/additional-text`. `description` has no slot: render a `ui5-text` after the field. Events: `change` <- `change`, `liveChange` <- `input` (`$parameters>/value` = current value), `submit` <- Enter keydown (WC has no submit event; `change` also fires on Enter), `suggestionItemSelected` <- `selection-change`.
  Not in v1: property `fieldWidth` (0/3), event `suggest` (0/2), property `showTableSuggestionValueHelp` (0/3), property `textFormatMode` (0/3), aggregation `suggestionColumns` (0/3), aggregation `suggestionRows` (0/3), property `autocomplete` (0/2), property `selectedKey` (0/1), aggregation `formattedValueStateText` (0/1), property `required` (0/2), property `valueHelpIconSrc` (0/1), property `enableTableAutoPopinMode` (0/1).
- **sap.m.TextArea** -> ui5-textarea (*direct*). `value` (two-way; `valueLiveUpdate` as Input), `rows`, `placeholder`, `growing`, `growingMaxLines` -> `growing-max-rows`, `maxLength` -> `maxlength`, `showExceededText` -> `show-exceeded-text`, `editable=false` -> `readonly`, `valueState`, `width` CSS; `wrapping` ignored; `liveChange` <- `input`.
  Not in v1: property `cols` (0/2).
- **sap.ui.core.Item** -> parent-dependent: ui5-option / ui5-cb-item / ui5-mcb-item / ui5-suggestion-item (*adapt*). Pure data element: `key` -> `value`, `text`. The tag is chosen by the parent (Select, ComboBox, MultiComboBox, Input suggestions).
- **sap.m.CheckBox** -> ui5-checkbox (*direct*). `selected` (two-way) -> `checked`, `text`, `enabled=false` -> `disabled`, `editable=false` -> `readonly`, `partiallySelected` -> `indeterminate`, `wrapping` -> `wrapping-type`, `valueState`, `required`; `select` <- `change` (`$parameters>/selected` = checked).
  Not in v1: property `width` (0/1).
- **sap.m.Switch** -> ui5-switch (*direct*). `state` (two-way) -> `checked`, `customTextOn`/`customTextOff` -> `text-on`/`text-off`, `type="AcceptReject"` -> `design="Graphical"`, `enabled=false` -> `disabled`; `change` <- `change` (`$parameters>/state` = checked).
- **sap.m.SegmentedButton** -> ui5-segmented-button (*adapt*). `selectedKey` (two-way) -> `selected` on the item whose key matches, written back on `selection-change`; `selectionChange` <- `selection-change` (pass the key, not `$parameters>/item` + JS call); `width` CSS (`items-fit-content`).
  Not in v1: property `contentMode` (0/1).
- **sap.m.SegmentedButtonItem** -> ui5-segmented-button-item (*adapt*). `text` -> text content, `icon`, `key` -> `data-key`, `enabled=false` -> `disabled`, `tooltip`.
- **sap.m.Select** -> ui5-select + ui5-option (*adapt*). Items (core:Item / ListItem) -> `<ui5-option value="{key}">{text}</ui5-option>` (`icon`, `additionalText` -> `additional-text`). `selectedKey` (two-way) -> `value` of the select (or `selected` on the matching option); write the chosen option's value back on `change`. `forceSelection=false` has no counterpart (WC always selects the first option) - insert an empty option. `enabled`/`editable`/`valueState`/`valueStateText`/`width` as Input. `change` <- `change`. `$parameters>/selectedItem` + `.getKey()` is UI5 object access - NOT portable; bind `selectedKey` instead.
  Not in v1: property `autoAdjustWidth` (0/1), property `icon` (0/1), property `type` (0/1), property `wrapItemsText` (0/2), property `columnRatio` (0/1), property `showSecondaryValues` (0/1), property `twoColumnSeparator` (0/1).
- **sap.m.DatePicker** -> ui5-date-picker (*direct*). `value` (two-way) with `valueFormat` -> `value-format` and `displayFormat` -> `display-format` (same CLDR patterns, e.g. `yyyyMMdd` for ABAP DATS); `placeholder`, `editable=false` -> `readonly`, `enabled`, `required`, `valueState`/`valueStateText`, `width` CSS, `minDate`/`maxDate` -> `min-date`/`max-date` (as strings in value-format). `dateValue` (JS Date, needs a formatter such as Formatter.DateAbapDateToDateObject) -> convert to `value`. `change` <- `change` (`$parameters>/value`, `$parameters>/valid`).
  Not in v1: property `hideInput` (0/1).
- **sap.m.SearchField** -> ui5-search-field (fiori) or ui5-input with a search icon (*adapt*). `value` (two-way), `placeholder`, `width` CSS; `search` <- `search` (`$parameters>/query` = value; `refreshButtonPressed`=false), `liveChange` <- `input` (`$parameters>/newValue`). `ui5-search-field` is a recent fiori component - check the minimum WC version; the `ui5-input` + `<ui5-icon slot="icon" name="search">` fallback is safe.
  Not in v1: property `enableSuggestions` (0/1), aggregation `suggestionItems` (0/1).
- **sap.m.ComboBox** -> ui5-combobox + ui5-cb-item (*adapt*). Items -> `<ui5-cb-item value="{key}" text="{text}" additional-text>`; `selectedKey` (two-way) <-> `selected-value`; `value`, `placeholder`, `showClearIcon`, `valueState`, `width` as Input; `change`/`selectionChange` <- `change`/`selection-change`. `showSecondaryValues` -> show `additional-text` (WC always shows it when set).
  Not in v1: property `maxWidth` (0/3), property `showSecondaryValues` (0/5), property `filterSecondaryValues` (0/3), event `loadItems` (0/1), property `maxPickerHeight` (0/1), aggregation `formattedValueStateText` (0/1).
- **sap.m.MultiInput** -> ui5-multi-input + ui5-token (*adapt*). `tokens` -> slot `tokens`; `showValueHelp` -> `show-value-help-icon`, `valueHelpRequest` <- `value-help-trigger`; `value`, `placeholder`, `enabled`, `width`, `showSuggestion` + `suggestionItems` as Input; `tokenUpdate` <- `token-delete` (`$parameters>/type`="removed", `removedTokens` - object access, not portable beyond the token keys). Token add/remove has to be written back into the bound token table by the renderer (UI5 apps use z2ui5.cc.MultiInputExt for that - excluded).
  Not in v1: property `maxTokens` (0/1), property `showTableSuggestionValueHelp` (0/1), property `type` (0/1), aggregation `suggestionColumns` (0/2), aggregation `suggestionRows` (0/2), property `showClearIcon` (0/1), property `valueStateText` (0/1), aggregation `formattedValueStateText` (0/1).
- **sap.m.Token** -> ui5-token (*adapt*). `text`, `selected`; `key` -> keep as `data-key`; `editable=false` has no per-token attribute (use `readonly` on the multi-input).
- **sap.m.MultiComboBox** -> ui5-multi-combobox + ui5-mcb-item (*adapt*). Items -> `<ui5-mcb-item value="{key}" text>`; `selectedKeys` (two-way, string array) <-> `selected` flags of the items (or `selected-values`); `placeholder`, `width`, `valueState`; `selectionChange` <- `selection-change`, `selectionFinish` <- `close`.
  Not in v1: property `showSecondaryValues` (0/2), property `maxWidth` (0/2), property `showSelectAll` (0/1), property `showClearIcon` (0/1), property `maxPickerHeight` (0/1), aggregation `formattedValueStateText` (0/1).
- **sap.m.StepInput** -> ui5-step-input (*direct*). `value` (two-way), `min`, `max`, `step`, `displayValuePrecision` -> `value-precision`, `enabled`/`editable`/`valueState`, `width` CSS; `change` <- `change` (`$parameters>/value`).
  Not in v1: property `description` (0/1), property `fieldWidth` (0/1), property `largerStep` (0/1), property `stepMode` (0/1), property `textAlign` (0/1), property `validationMode` (0/1).
- **sap.ui.core.ListItem** -> as core:Item (+ additional-text, icon) (*adapt*). `additionalText` -> `additional-text`; `icon` -> `icon` (`ui5-option` only).
  Not in v1: property `icon` (0/2).
- **sap.m.DateTimePicker** -> ui5-datetime-picker (*direct*). As DatePicker (`value`/`valueFormat`/`displayFormat`, `dateValue` via conversion).
  Not in v1: property `initialFocusedDateValue` (0/1), property `minutesStep` (0/1), property `secondaryCalendarType` (0/1), property `secondsStep` (0/1), property `showCurrentDateButton` (0/1), property `showCurrentTimeButton` (0/1), property `showTimezone` (0/1), property `timezone` (0/1), property `hideInput` (0/1).

### Actions

- **sap.m.Button** -> ui5-button (*direct*). `text` -> text content, `icon`, `type` -> `design`: Default/Emphasized/Transparent/Attention as is, Accept/Success -> Positive, Reject/Negative -> Negative, Critical -> Attention, Ghost -> Transparent, Back -> Transparent + `icon="nav-back"`, Up -> `icon="navigation-up-arrow"`; `enabled=false` -> `disabled`, `tooltip` -> `tooltip`, `width` CSS, `ariaHasPopup` -> `accessibility-attributes`. `press` <- `click`. A Button is also the usual `opener` of a popover (by id).
  Not in v1: property `badgeStyle` (0/1).
- **sap.m.ToggleButton** -> ui5-toggle-button (*direct*). `pressed` (two-way), `text`, `icon`, `type` -> `design`, `enabled`; `press` <- `click` (`$parameters>/pressed` = new pressed state).

### Collections & tables

- **sap.m.Column** -> ui5-table-header-cell (*adapt*). `header` child -> cell content; `width` -> `width`; `hAlign` Begin/Center/End/Left/Right -> `horizontal-align` (also on the column's cells); `minScreenWidth`/`demandPopin`/`importance` -> `importance` + table `overflow-mode="Popin"` (WC pops in by importance, not by breakpoint); `visible=false` -> drop the header cell AND that cell of every row; `mergeDuplicates` -> no counterpart (ignore).
  Not in v1: property `popinDisplay` (0/7), property `styleClass` (0/1), property `mergeFunctionName` (0/1), property `sortIndicator` (0/1), property `vAlign` (0/1).
- **sap.m.ColumnListItem** -> ui5-table-row (*adapt*). `cells` -> `ui5-table-cell`s; `type` Active/Navigation/Detail -> `interactive` (+ `navigated` for Navigation); `press` <- table `row-click` dispatched to the clicked row's wire (with that row as context); `selected` (two-way) <-> selection feature; `vAlign` CSS; `highlight` -> no WC attribute (left border CSS).
  Not in v1: property `navigated` (0/1), aggregation `actions` (0/1).
- **sap.m.Table** -> ui5-table (+ ui5-table-header-row/-header-cell/-row/-cell, features ui5-table-selection-*, ui5-table-growing) (*adapt*). `columns` -> `<ui5-table-header-row slot="headerRow">` with one `ui5-table-header-cell` per Column; `items` (list binding over a client array) -> one `ui5-table-row` per entry (row context for relative bindings and `${REL}` event args), each `cells` child in a `ui5-table-cell`. `mode` None/SingleSelect/SingleSelectLeft/SingleSelectMaster/MultiSelect -> `<ui5-table-selection-single|multi slot="features">`; WC selection is a space-separated list of `row-key`s while UI5 binds `ColumnListItem.selected` per row: the renderer derives `row-key` (row index) and keeps both in sync. `growing`/`growingThreshold` -> `<ui5-table-growing slot="features" mode="Button|Scroll">` with local paging (all rows are already on the client). `headerText`/`headerToolbar`/`infoToolbar`: no slot - render above the table. `noDataText` -> `no-data-text`, `sticky` -> `sticky` on the header row, `alternateRowColors` -> `alternate-row-colors`, `width` CSS; `inset`/`popinLayout`/`fixedLayout`/`contextualWidth` ignored. `selectionChange` <- selection feature `change`; `itemPress` <- table `row-click`.
  Not in v1: aggregation `dragDropConfig` (1/1), property `contextualWidth` (0/4), property `showSeparators` (0/4), property `showOverlay` (0/1), property `fixedLayout` (0/3), aggregation `contextMenu` (0/1), event `paste` (0/1), property `autoPopinMode` (0/2), property `hiddenInPopin` (0/1), event `popinChanged` (0/1), property `itemActionCount` (0/1), property `multiSelectMode` (0/1).
- **sap.m.List** -> ui5-list (*adapt*). `items` (list binding) -> list items; `headerText` -> `header-text`; `headerToolbar` -> slot `header`; `mode` None/SingleSelect/SingleSelectLeft/SingleSelectMaster/MultiSelect/Delete -> `selection-mode` None/Single/SingleStart/Single/Multiple/Delete; `noDataText` -> `no-data-text`; `showSeparators` All/Inner/None -> `separators`; `growing` -> `growing="Button"` + local paging on `load-more`. `selectionChange` <- `selection-change` (write item `selected` back; `$parameters>/listItem` + JS is not portable), `itemPress` <- `item-click`, `delete` <- `item-delete`.
  Not in v1: property `backgroundDesign` (0/2), property `footerText` (0/1), property `growingScrollToLoad` (0/2), property `showUnread` (0/1), aggregation `contextMenu` (0/1), aggregation `swipeContent` (0/1), event `swipe` (0/1), aggregation `infoToolbar` (0/4), property `sticky` (0/1), property `enableBusyIndicator` (0/5), property `growingDirection` (0/1), property `growingTriggerText` (0/1).
- **sap.m.StandardListItem** -> ui5-li (*direct*). `title` -> `text`, `description`, `icon` (sap-icon://x -> `icon="x"`; an image URL -> `<img slot="image">`), `info` -> `additional-text`, `infoState` -> `additional-text-state` (Success->Positive, …), `highlight` -> `highlight`, `type` Inactive/Active/Navigation/Detail/DetailAndActive -> `type` (Inactive/Active/Navigation/Detail), `selected` (two-way), `wrapping` -> `wrapping-type="Normal"`, `counter` -> append to `additional-text`; `press` <- `click`, `detailPress` <- `detail-click`.
  Not in v1: property `unread` (0/1), property `adaptTitleSize` (0/2), aggregation `avatar` (0/1), property `infoStateInverted` (0/2), property `infoIcon` (0/1), property `wrapCharLimit` (0/1), property `navigated` (0/1).
- **sap.m.CustomListItem** -> ui5-li-custom (*direct*). Content -> default slot; `type`, `selected`, `highlight` as StandardListItem; `press` <- `click`.
- **sap.m.Tree** -> ui5-tree (*adapt*). `items="{/T_NODES}"` binds a NESTED client array (UI5 JSONModel tree binding: every array-valued property of a node is its children) - the renderer recurses and emits nested `ui5-tree-item`s. `headerText` -> `header-text`, `mode` -> `selection-mode`, `headerToolbar` -> slot `header`; `toggleOpenState` <- `item-toggle`.
  Not in v1: aggregation `dragDropConfig` (1/1), aggregation `contextMenu` (0/1), property `includeItemInSelection` (0/1), aggregation `infoToolbar` (0/1).
- **sap.m.StandardTreeItem** -> ui5-tree-item (*direct*). `title` -> `text`, `icon`, `selected`, `expanded` (UI5 keeps expansion in the binding; default collapsed).

### Dialogs & popups

- **sap.m.Dialog** -> ui5-dialog (*adapt*). Shown via `client->popup_display( )` (slot POPUP) -> render and set `open`; `popup_destroy( )` / action POPUP_CLOSE -> close + remove. `title` -> `header-text`, `icon` -> custom `header` slot, `state` Error/Warning/Success/Information -> `state` Negative/Critical/Positive/Information, `contentWidth`/`contentHeight` -> CSS width/height of the content wrapper, `resizable`, `draggable`, `stretch`; `buttons` / `beginButton` / `endButton` / `footer` -> `<ui5-bar slot="footer">` endContent (begin before end); `customHeader`/`subHeader` -> slot `header`; `showHeader=false` -> empty header; `verticalScrolling`/`horizontalScrolling` CSS overflow. `afterClose` <- `close` (Escape closes a WC dialog client-side: the renderer must fire the `afterClose` wire, or cancel `before-close` when none is wired, so the server popup state does not drift).
  Not in v1: property `showFullScreenButton` (0/1).
- **sap.m.Popover** -> ui5-popover (*adapt*). Shown via `client->popover_display( xml, by_id )` -> `opener` = the DOM id of the control with that view id, `open=true`; POPOVER_CLOSE / `popover_destroy( )` -> close. `title` -> `header-text` (`showHeader=false` -> none), `placement` Top/Bottom/Left/Right/Auto/PreferredTopOrFlip… -> `placement` Top/Bottom/Start/End (Auto -> End), `contentWidth`/`contentHeight` CSS, `footer` -> slot `footer`, `modal`; `afterClose` <- `close`.
  Not in v1: event `afterOpen` (0/1), property `resizable` (0/1), property `verticalScrolling` (0/1), aggregation `customHeader` (0/1), property `contentMinWidth` (0/1).

### Messages

- **sap.m.MessageStrip** -> ui5-message-strip (*direct*). `text` -> text content; `type` Information/Success/Warning/Error/None -> `design` Information/Positive/Critical/Negative/Information(+`hide-icon`); `showIcon=false` (UI5 default false!) -> `hide-icon`; UI5 has NO close button by default, WC does: set `hide-close-button` unless `showCloseButton=true`; `close` <- `close`. `enableFormattedText` -> limited HTML (a, b, i, strong, em, br, code) in the text.
  Not in v1: aggregation `link` (0/1), aggregation `controls` (0/1), property `colorScheme` (0/1).

### Tolerated (no visual)

- **sap.ui.core.CustomData** -> none - data-* attribute (*compose*). `writeToDom=true` -> `data-{key}="{value}"` on the parent element, otherwise drop. (`$event.getSource().data(...)` readers are not portable.)
- **sap.m.FlexItemData** -> none - CSS on the child (*compose*). `growFactor` -> `flex-grow`, `shrinkFactor` -> `flex-shrink`, `baseSize` -> `flex-basis`, `alignSelf`, `maxWidth`. Safe to drop.
  Not in v1: property `styleClass` (0/5), property `order` (0/1), property `backgroundDesign` (0/5), property `maxWidth` (0/5).
- **sap.ui.layout.GridData** -> none - CSS on the child (*compose*). `span="XL6 L6 M12 S12"`/`spanL…` -> `grid-column: span n` per breakpoint, `linebreak*` -> `grid-column-start:1`, `indent*` -> start offset. Safe to drop.
  Not in v1: property `indent` (0/2), property `indentL` (0/2), property `indentXL` (0/1), property `linebreakM` (0/2), property `spanL` (0/1), property `spanM` (0/1), property `spanS` (0/1), property `spanXL` (0/1), property `visibleL` (0/1), property `visibleM` (0/2), property `visibleS` (0/2), property `visibleXL` (0/1).
- **sap.m.OverflowToolbarLayoutData** -> overflow-priority on the toolbar item (*adapt*). `priority` NeverOverflow/AlwaysOverflow/High/Low -> `overflow-priority` (Default for High/Low). Safe to drop.
  Not in v1: property `group` (0/5), property `minWidth` (0/3), property `shrinkable` (0/6), property `closeOverflowOnInteraction` (0/1), property `maxWidth` (0/2).

<!-- portable:mapping:end -->
