# Portable view profile - coverage curve

Data basis: `census.json` in this folder (method, limitations and every number below are in it).
**Core corpus** = abap2UI5/samples (138 apps with a view) + samples-stack (32) + addons/real-world apps (77: popups, selection-screen, sapgui, abap-cloud-gui, admin-cockpit, agent) = **247 apps**.
**samples-controls** (642 ports of the UI5 demo kit) is reported separately: it is built to show every control, so it is a stress test, not a usage sample.
Method: exact view XML from the abap2UI5 linter's view reconstruction (`prepareAbap`), not a regex scan.
"Fully covered" = every control the app uses (in any of its documents: main view, popups, popovers, fragments) is in the set; `mvc:View` / `core:FragmentDefinition` are document roots and always free.
Ranking = number of core apps using the control (ties: samples-controls usage). The core corpus uses **149 distinct controls**, samples-controls **387**.

## 1. Coverage by top-N controls

| top N controls | core: samples+stack+addons (247 apps) | samples (138) | stack (32) | addons (77) | samples-controls (642), same ranking | samples-controls, ranked by its own frequency | last control added at N |
|---:|---:|---:|---:|---:|---:|---:|---|
| 10 | **22.7%** (56) | 11.6% | 18.8% | 44.2% | 0.8% | 1.9% | sap.m.Column |
| 20 | **36%** (89) | 25.4% | 21.9% | 61% | 3.9% | 5.1% | sap.m.ObjectStatus |
| 30 | **53.4%** (132) | 45.7% | 53.1% | 67.5% | 6.4% | 11.1% | sap.m.SegmentedButtonItem |
| 40 | **64.8%** (160) | 58.7% | 62.5% | 76.6% | 10.7% | 14.2% | sap.ui.core.Icon |
| 60 | **73.7%** (182) | 71.7% | 68.8% | 79.2% | 15.1% | 26.6% | sap.m.StandardTreeItem |
| 80 | **81%** (200) | 78.3% | 78.1% | 87% | 25.9% | 37.5% | sap.ui.core.dnd.DragDropInfo |

Finer grid (core, frequency ranking):

| N | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 70 | 80 | 90 | 100 | 120 | 149 (all) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| core % | 14.2 | 22.7 | 30.4 | 36 | 47.8 | 53.4 | 59.1 | 64.8 | 66.8 | 68.4 | 70 | 73.7 | 77.7 | 81 | 84.2 | 86.6 | 91.5 | 100 |
| core apps | 35 | 56 | 75 | 89 | 118 | 132 | 146 | 160 | 165 | 169 | 173 | 182 | 192 | 200 | 208 | 214 | 226 | 247 |

A set chosen greedily for coverage (repeatedly add the missing controls of the app group that completes the most apps per added control) does a little better at small N:

| N | 10 | 20 | 30 | 40 | 60 | 80 | 100 | 120 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| core, greedy set % | 25.9 | 42.5 | 58.3 | 67.6 | 76.5 | 85.4 | 91.9 | 96 |
| samples-controls, its own greedy set % | 5.8 | 12.6 | 17.8 | 23.1 | 34.1 | 44.9 | 54 | 60.7 |

## 2. The knee

Marginal gain per added control (core apps):

| controls | 1-10 | 11-20 | 21-30 | 31-40 | 41-50 | 51-60 | 61-80 | 81-100 | 101-120 | 121-149 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| apps gained per control | 5.6 | 3.3 | 4.3 | 2.8 | 0.9 | 1.3 | 0.9 | 0.7 | 0.6 | 0.7 |

**The knee is at N ~ 40 (65% of core apps).** Up to 40 controls every added control completes ~3-6 apps; after 40 the gain drops to ~1 app per control and stays there - the remaining ~35% of apps are a long tail where almost every app needs its own 1-3 rare controls (missing-control count of the 87 apps uncovered at N=40: 1 missing: 37, 2 missing: 16, 3 missing: 19, 4 missing: 9, 5+ missing: 6).
The step at N=21-25 is `sap.ui.core.Item` + Select/SegmentedButton-type controls completing many small apps at once (an item element is worthless alone).

samples-controls has **no knee**: ranked by its own frequency it needs ~120 controls for 54% and ~250 for 93% (greedy). A portable profile cannot and should not aim at the demo-kit collection; it is useful only to check that the chosen properties of the v1 controls are not too narrow.

## 3. What blocks apps beyond the knee (top-40 set)

| control (not in top 40) | uncovered apps it blocks | apps where it is the ONLY missing control |
|---|---:|---:|
| sap.m.CustomListItem | 5 | 1 |
| sap.m.ObjectNumber | 5 | 1 |
| sap.m.ScrollContainer | 4 | 3 |
| sap.ui.table.RowAction | 4 | 0 |
| sap.ui.table.RowActionItem | 4 | 0 |
| sap.m.IconTabFilter | 4 | 0 |
| sap.tnt.InfoLabel | 4 | 2 |
| sap.m.MessageItem | 4 | 0 |
| sap.m.Tree | 4 | 0 |
| sap.f.DynamicPage | 3 | 1 |
| sap.m.ProgressIndicator | 3 | 0 |
| sap.m.ComboBox | 3 | 1 |
| sap.m.MultiInput | 3 | 0 |
| sap.m.Token | 3 | 0 |
| sap.m.NavContainer | 3 | 1 |
| sap.f.FlexibleColumnLayout | 3 | 1 |
| sap.m.QuickView | 3 | 0 |
| sap.m.QuickViewPage | 3 | 0 |
| sap.m.IconTabBar | 3 | 0 |
| sap.ui.core.CustomData | 3 | 3 |
| sap.m.MessagePopover | 3 | 0 |
| sap.m.StandardTreeItem | 3 | 0 |
| sap.m.Bar | 2 | 2 |
| z2ui5.cc.FileUploader | 2 | 2 |
| z2ui5.cc.InputExt | 2 | 2 |
| sap.m.TableSelectDialog | 2 | 2 |

The blockers split into three kinds:
1. **Cheap leftovers that belong in the profile** (one web component or a div each): ScrollContainer, CustomData (tolerate), CustomListItem, ObjectNumber, IconTabBar/IconTabFilter, InfoLabel, ProgressIndicator, ComboBox, MultiInput/Token, Tree/StandardTreeItem, Bar - all added to profile v1.
2. **Page-level / enterprise controls** with no or a very different web-component counterpart: sap.ui.table (grid table with RowAction), MessagePopover/MessageItem/MessageView, DynamicPage, FlexibleColumnLayout, NavContainer, QuickView, TableSelectDialog/SelectDialog, Menu - candidates for v1.1.
3. **Not portable by design**: `sap.ui.comp` smart controls (OData metadata driven), `z2ui5.cc.*` custom controls (abap2UI5 frontend extensions - Tree, FileUploader, InputExt, MultiInputExt, Storage, Geolocation, Camera…, 19 core apps), charts/gantt/vbm/code editor, drag & drop configs, `html:` elements.

## 4. Proposed profile v1 (see portable-proposal.md)

Profile v1 = the top-40 plus the cheap leftovers, minus sap.ui.table and the message popover: **61 rendered controls + 4 tolerated layout/data elements**.

| | core | samples | stack | addons | samples-controls |
|---|---:|---:|---:|---:|---:|
| controls only (profile v1, 61 rendered + 4 tolerated) | **73.7%** | 68.8% | 71.9% | 83.1% | 31% |
| + only v1 properties/aggregations/events | **73.3%** | 68.1% | 71.9% | 83.1% | 18.5% |
| + only v1 binding forms | **71.3%** | 65.9% | 65.6% | 83.1% | 17.6% |
| + only v1 event-argument descriptors | **69.2%** | 62.3% | 65.6% | 83.1% | 16.7% |
| + only v1 frontend actions | **65.2%** | 58.7% | 53.1% | 81.8% | 16.4% |
| + only v1 client API (= runs fully on a v1 renderer) | **64.8%** | 58% | 53.1% | 81.8% | 16.4% |
| v1 + v1.1 candidates (104 entries): controls only | **82.6%** | | | | 45.5% |
| v1 + v1.1 candidates: everything | **68.8%** | | | | 19% |

Control coverage of v1 equals the frequency top-60 (73.7%) but with a better samples-controls coverage (31.0% vs 15.1%), because it swaps rare-but-hard core controls for frequent-and-cheap demo-kit ones (VerticalLayout, HorizontalLayout, ToggleButton, Image, GridData, FlexItemData).
Remaining control blockers with v1:

| missing control | core apps blocked | as only blocker |
|---|---:|---:|
| sap.ui.table.Column | 7 | 0 |
| sap.ui.table.Table | 7 | 0 |
| sap.ui.table.RowAction | 4 | 0 |
| sap.ui.table.RowActionItem | 4 | 0 |
| sap.m.MessageItem | 4 | 0 |
| sap.f.DynamicPage | 3 | 1 |
| sap.m.NavContainer | 3 | 2 |
| sap.f.FlexibleColumnLayout | 3 | 1 |
| sap.m.QuickView | 3 | 0 |
| sap.m.QuickViewPage | 3 | 0 |
| sap.m.MessagePopover | 3 | 0 |
| z2ui5.cc.Tree | 3 | 1 |
| sap.ui.comp.smartfilterbar.ControlConfiguration | 3 | 0 |
| sap.ui.comp.smartfilterbar.SmartFilterBar | 3 | 0 |
| sap.ui.comp.smarttable.SmartTable | 3 | 0 |
| sap.m.TableSelectDialog | 3 | 2 |
| sap.f.DynamicPageTitle | 2 | 0 |
| z2ui5.cc.FileUploader | 2 | 2 |
| z2ui5.cc.MultiInputExt | 2 | 2 |
| sap.m.Menu | 2 | 0 |

Among the apps whose controls are all in v1, what still keeps an app from running unchanged:

| reason (among apps whose controls are all in v1) | core apps |
|---|---:|
| action CONTROL_BY_ID | 5 |
| eventArg $event... | 4 |
| clientApi nest_view_display | 3 |
| binding named model {m>/path} | 3 |
| eventArg JS method call on arg | 3 |
| binding expression-binding:named-model-ref | 2 |
| action BINDING_CALL | 2 |
| action CROSS_APP_NAV_TO_EXT | 2 |
| binding type=sap.ui.model.odata.type.String | 1 |
| member sap.m.ColumnListItem/repeat | 1 |
| member sap.m.Table/repeat | 1 |
| binding formatter=Formatter.expandInlineIcons | 1 |
| action BIND_ELEMENT | 1 |
| clientApi nest2_view_display | 1 |

samples-controls under v1 is mostly blocked by ObjectPage (sap.uxap), ObjectAttribute/ObjectHeader, Avatar, Slider, PlanningCalendar, Form/FormContainer/FormElement, ResponsivePopover:

| missing control | samples-controls apps blocked |
|---|---:|
| sap.uxap.ObjectPageLayout | 49 |
| sap.uxap.ObjectPageSection | 49 |
| sap.uxap.ObjectPageSubSection | 49 |
| sap.m.ObjectAttribute | 43 |
| sap.m.Avatar | 40 |
| sap.m.Slider | 37 |
| sap.uxap.ObjectPageDynamicHeaderTitle | 30 |
| sap.ui.table.Column | 27 |
| sap.m.ObjectHeader | 26 |
| sap.ui.unified.CalendarAppointment | 24 |
| sap.ui.table.Table | 21 |
| sap.uxap.ObjectPageHeader | 19 |
| sap.ui.layout.form.Form | 18 |
| sap.ui.layout.form.FormContainer | 18 |
| sap.ui.layout.form.FormElement | 18 |

## 5. Rankings

Core ranking (top 60):

| # | control | core apps | samples | stack | addons | samples-controls apps |
|---:|---|---:|---:|---:|---:|---:|
| 1 | sap.m.Page | 195 | 135 | 32 | 28 | 162 |
| 2 | sap.m.Shell | 193 | 135 | 31 | 27 | 15 |
| 3 | sap.m.Button | 169 | 99 | 23 | 47 | 273 |
| 4 | sap.m.MessageStrip | 153 | 135 | 12 | 6 | 45 |
| 5 | sap.m.Text | 115 | 68 | 16 | 31 | 310 |
| 6 | sap.m.Input | 87 | 56 | 15 | 16 | 117 |
| 7 | sap.m.Label | 86 | 56 | 12 | 18 | 286 |
| 8 | sap.m.VBox | 72 | 46 | 5 | 21 | 194 |
| 9 | sap.ui.layout.form.SimpleForm | 70 | 47 | 11 | 12 | 115 |
| 10 | sap.m.Column | 65 | 30 | 15 | 20 | 69 |
| 11 | sap.m.ColumnListItem | 65 | 30 | 15 | 20 | 69 |
| 12 | sap.m.Table | 63 | 30 | 15 | 18 | 63 |
| 13 | sap.m.Title | 58 | 37 | 15 | 6 | 181 |
| 14 | sap.m.Dialog | 46 | 12 | 2 | 32 | 33 |
| 15 | sap.m.OverflowToolbar | 43 | 27 | 2 | 14 | 113 |
| 16 | sap.m.ToolbarSpacer | 37 | 17 | 6 | 14 | 117 |
| 17 | sap.m.HBox | 35 | 24 | 7 | 4 | 64 |
| 18 | sap.m.List | 24 | 21 | 1 | 2 | 74 |
| 19 | sap.m.StandardListItem | 18 | 17 | 0 | 1 | 59 |
| 20 | sap.m.ObjectStatus | 17 | 10 | 5 | 2 | 51 |
| 21 | sap.m.Toolbar | 16 | 3 | 12 | 1 | 55 |
| 22 | sap.m.Panel | 15 | 12 | 1 | 2 | 71 |
| 23 | sap.m.Link | 14 | 12 | 1 | 1 | 94 |
| 24 | sap.ui.layout.Grid | 13 | 11 | 0 | 2 | 26 |
| 25 | sap.ui.core.Item | 12 | 4 | 0 | 8 | 132 |
| 26 | sap.m.TextArea | 12 | 7 | 0 | 5 | 17 |
| 27 | sap.m.CheckBox | 11 | 7 | 0 | 4 | 36 |
| 28 | sap.m.Switch | 10 | 6 | 0 | 4 | 24 |
| 29 | sap.m.SegmentedButton | 10 | 8 | 0 | 2 | 23 |
| 30 | sap.m.SegmentedButtonItem | 10 | 8 | 0 | 2 | 23 |
| 31 | sap.m.Select | 8 | 2 | 0 | 6 | 85 |
| 32 | sap.m.DatePicker | 8 | 3 | 3 | 2 | 23 |
| 33 | sap.ui.core.HTML | 7 | 5 | 0 | 2 | 60 |
| 34 | sap.m.FlexBox | 7 | 6 | 0 | 1 | 54 |
| 35 | sap.m.ObjectIdentifier | 7 | 3 | 0 | 4 | 50 |
| 36 | sap.m.SearchField | 7 | 6 | 0 | 1 | 29 |
| 37 | sap.ui.table.Column | 7 | 7 | 0 | 0 | 27 |
| 38 | sap.ui.table.Table | 7 | 7 | 0 | 0 | 21 |
| 39 | sap.m.Popover | 7 | 6 | 1 | 0 | 12 |
| 40 | sap.ui.core.Icon | 6 | 5 | 1 | 0 | 18 |
| 41 | sap.m.ObjectNumber | 5 | 4 | 0 | 1 | 50 |
| 42 | sap.m.CustomListItem | 5 | 3 | 0 | 2 | 7 |
| 43 | sap.m.IconTabFilter | 4 | 3 | 0 | 1 | 35 |
| 44 | sap.m.ScrollContainer | 4 | 3 | 0 | 1 | 24 |
| 45 | sap.m.MessageItem | 4 | 2 | 0 | 2 | 16 |
| 46 | sap.m.Tree | 4 | 4 | 0 | 0 | 9 |
| 47 | sap.tnt.InfoLabel | 4 | 1 | 3 | 0 | 4 |
| 48 | sap.ui.table.RowAction | 4 | 4 | 0 | 0 | 1 |
| 49 | sap.ui.table.RowActionItem | 4 | 4 | 0 | 0 | 1 |
| 50 | sap.m.ComboBox | 3 | 2 | 0 | 1 | 36 |
| 51 | sap.m.IconTabBar | 3 | 2 | 0 | 1 | 30 |
| 52 | sap.m.ProgressIndicator | 3 | 2 | 0 | 1 | 21 |
| 53 | sap.f.DynamicPage | 3 | 3 | 0 | 0 | 16 |
| 54 | sap.m.NavContainer | 3 | 3 | 0 | 0 | 15 |
| 55 | sap.m.MultiInput | 3 | 1 | 0 | 2 | 14 |
| 56 | sap.m.Token | 3 | 1 | 0 | 2 | 12 |
| 57 | sap.f.FlexibleColumnLayout | 3 | 3 | 0 | 0 | 11 |
| 58 | sap.m.MessagePopover | 3 | 2 | 0 | 1 | 11 |
| 59 | sap.ui.core.CustomData | 3 | 3 | 0 | 0 | 11 |
| 60 | sap.m.StandardTreeItem | 3 | 3 | 0 | 0 | 8 |

samples-controls ranking (top 40):

| # | control | samples-controls apps | core apps |
|---:|---|---:|---:|
| 1 | sap.m.Text | 310 | 115 |
| 2 | sap.m.Label | 286 | 86 |
| 3 | sap.m.Button | 273 | 169 |
| 4 | sap.m.VBox | 194 | 72 |
| 5 | sap.m.Title | 181 | 58 |
| 6 | sap.ui.layout.VerticalLayout | 174 | 2 |
| 7 | sap.m.Page | 162 | 195 |
| 8 | sap.ui.core.Item | 132 | 12 |
| 9 | sap.m.Input | 117 | 87 |
| 10 | sap.m.ToolbarSpacer | 117 | 37 |
| 11 | sap.ui.layout.form.SimpleForm | 115 | 70 |
| 12 | sap.m.OverflowToolbar | 113 | 43 |
| 13 | sap.m.Link | 94 | 14 |
| 14 | sap.m.Select | 85 | 8 |
| 15 | sap.m.List | 74 | 24 |
| 16 | sap.m.Panel | 71 | 15 |
| 17 | sap.m.Column | 69 | 65 |
| 18 | sap.m.ColumnListItem | 69 | 65 |
| 19 | sap.m.HBox | 64 | 35 |
| 20 | sap.m.Table | 63 | 63 |
| 21 | sap.ui.core.HTML | 60 | 7 |
| 22 | sap.m.StandardListItem | 59 | 18 |
| 23 | sap.m.Toolbar | 55 | 16 |
| 24 | sap.ui.core.Title | 55 | 1 |
| 25 | sap.m.FlexBox | 54 | 7 |
| 26 | sap.ui.layout.HorizontalLayout | 52 | 0 |
| 27 | sap.m.ObjectStatus | 51 | 17 |
| 28 | sap.m.Image | 51 | 2 |
| 29 | sap.m.ObjectIdentifier | 50 | 7 |
| 30 | sap.m.ObjectNumber | 50 | 5 |
| 31 | sap.uxap.ObjectPageLayout | 49 | 1 |
| 32 | sap.uxap.ObjectPageSection | 49 | 1 |
| 33 | sap.uxap.ObjectPageSubSection | 49 | 1 |
| 34 | sap.m.MessageStrip | 45 | 153 |
| 35 | sap.m.ObjectAttribute | 43 | 1 |
| 36 | sap.m.ToggleButton | 43 | 1 |
| 37 | sap.m.Bar | 40 | 2 |
| 38 | sap.m.Avatar | 40 | 0 |
| 39 | sap.m.OverflowToolbarButton | 37 | 2 |
| 40 | sap.m.FlexItemData | 37 | 1 |
