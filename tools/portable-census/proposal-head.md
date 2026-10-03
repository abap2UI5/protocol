# abap2UI5 portable view profile v1 - proposal

Status: proposal, derived from the census in `census.json` / `coverage.md` (same folder).
Target renderers: UI5 Web Components first (`@ui5/webcomponents` / `@ui5/webcomponents-fiori` 2.x - tag, attribute, slot and event names below were checked against the 2.27.2 `custom-elements.json` manifests), later Adaptive Cards / native mobile.

**What "portable" means here:** an abap2UI5 app whose views stay inside this profile runs unchanged on any conforming renderer. The profile is a subset of the UI5 XML view vocabulary that abap2UI5 already sends (no new ABAP API); a renderer reads the same view XML, the same JSON model and the same event wires.

**Notation:** `(a/b)` after a member = number of apps using it in the core corpus (samples + stack + addons, 247 apps) / in samples-controls (642 demo-kit ports). Fit: **direct** = one web component, attribute names translate 1:1; **adapt** = a web component exists but structure, attribute values or events must be translated; **compose** = no web component, build from HTML/CSS or from several components.

## 1. Result in one table

| | core apps fully covered | samples-controls |
|---|---:|---:|
| controls of profile v1 (61 rendered + 4 tolerated) | **73.7 %** (182/247) | 31.0 % |
| ... and only v1 properties/aggregations/events | 73.3 % | 18.5 % |
| ... and only v1 binding forms | 71.3 % | 17.6 % |
| ... and only v1 event-argument descriptors | 69.2 % | 16.7 % |
| ... and only v1 frontend actions + client API = **runs unchanged** | **64.8 %** (160/247) | 16.4 % |
| v1 + all v1.1 candidates (section 9) - controls / everything | 82.6 % / 68.8 % | 45.5 % / 19.0 % |

By corpus (runs unchanged): samples 58.0 %, stack 53.1 % (launchpad/smart-control apps), addons 81.8 %.
The 40-control knee of the coverage curve sits at 65 % (`coverage.md` section 2); v1 takes the knee set, adds the cheap web-component leftovers that block apps right after it, and drops the two expensive families (sap.ui.table, MessagePopover) to v1.1.

## 2. Document model (what every renderer must handle)

- **Documents:** `sap.ui.core.mvc.View` (root of `view_display`, 215 core apps) and `sap.ui.core.FragmentDefinition` (root of popups/popovers, 58 core apps). Root attributes `displayBlock`, `height` are layout hints; `xmlns:*` declare the namespaces below. `core:require` (type aliases, samples-controls only) is excluded.
- **View slots:** MAIN (`view_display`), POPUP (`popup_display` / `popup_destroy` / `popup_model_update`, 49 core apps) and POPOVER (`popover_display( xml, by_id )` / `popover_destroy`, 11). The nested slots NEST/NEST2 (`nest_view_display`, 6 core apps) are v1.1.
- **Namespaces in v1:** `sap.m`, `sap.ui.core`, `sap.ui.layout`, `sap.ui.layout.form`, `sap.tnt`, `sap.ui.core.mvc`. Any element from another namespace makes the view non-portable (renderer shows a placeholder and logs).
- **Elements:** an uppercase element is a control, a lowercase element in the parent's namespace is an aggregation of the enclosing control. Every control's **default aggregation** may be written with or without its tag (`<VBox><items>…</items></VBox>` = `<VBox>…</VBox>`).
- **Universal attributes on every control:** `id` (must stay addressable: popover `opener`, SET_FOCUS, SCROLL_TO, `Label.labelFor` - keep it as DOM id, prefixed per slot), `class` (CSS classes; see below), `visible` (bindable), `tooltip` (string or binding -> `tooltip`/`title`), `busy`/`busyIndicatorDelay` (overlay `ui5-busy-indicator`), `fieldGroupIds` (ignore), `binding` (element binding: sets the context path for relative bindings of the subtree), `layoutData`, `customData`, `dependents` (render the dependent controls, e.g. a dialog, hidden).
- **CSS classes:** the core corpus uses 22 distinct classes, 18 of them UI5 spacing helpers (`sapUiSmallMargin` in 149 apps, then `sapUiSmallMarginTop/Bottom/Begin/End`, `sapUiTinyMargin*`, `sapUiMediumMargin*`, `sapUiContentPadding`, `sapUiResponsiveMargin`). A renderer ships these ~30 helper classes as plain CSS (margins 0.25/0.5/1/2 rem); app classes are passed through and styled by `core:HTML` `<style>` content.
- **Tolerated elements:** `sap.ui.core.CustomData`, `sap.m.FlexItemData`, `sap.ui.layout.GridData`, `sap.m.OverflowToolbarLayoutData` carry no own UI. A renderer applies what it can (flex-grow, grid span, overflow priority, `data-*`) and may drop the rest without breaking the app.

## 3. Control list v1 (61 rendered + 4 tolerated)

Per control: the properties/aggregations/events of v1 with usage counts, the Web Component mapping, and the members seen in the corpora that are **not** in v1. A member is in v1 when at least one core app or at least 8 samples-controls apps use it, plus a few cheap ones added by hand; universal attributes (section 2) are not repeated. "In v1" means a renderer must ACCEPT the member; where the mapping says "ignored" (e.g. Table `inset`, SimpleForm `layout`) it is accepted without visual effect.
