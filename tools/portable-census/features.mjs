// member-level + feature-level coverage for the v1 profile
import fs from 'fs';
const c = JSON.parse(fs.readFileSync('raw.json', 'utf8'));
const V1 = new Set(JSON.parse(fs.readFileSync(process.argv[2] || 'v1.json', 'utf8')));
const FREE = new Set(['sap.ui.core.mvc.View', 'sap.ui.core.FragmentDefinition']);
const TOLERATED = new Set(['sap.ui.core.CustomData', 'sap.m.FlexItemData', 'sap.ui.layout.GridData', 'sap.m.OverflowToolbarLayoutData']);
const apps = c.apps.map((a) => ({ ...a, need: a.controls.filter((x) => !FREE.has(x)) }));
const core = apps.filter((a) => a.corpus !== 'controls'), ctl = apps.filter((a) => a.corpus === 'controls');

// member usage per corpus group
const mem = {};
for (const a of apps) for (const m of a.members) { const e = (mem[m] ??= { core: 0, controls: 0 }); e[a.corpus === 'controls' ? 'controls' : 'core']++; }
const ctrlOf = (m) => m.split(/[.@/](?=[a-z][\w]*( \(|$))/)[0];
const splitM = (m) => { const i = Math.max(m.lastIndexOf('.'), m.lastIndexOf('@'), m.lastIndexOf('/')); return [m.slice(0, i), m[i], m.slice(i + 1)]; };
// universal members every renderer must accept on any control
const UNIVERSAL = new Set(['visible', 'tooltip', 'layoutData', 'customData', 'dependents', 'busy', 'busyIndicatorDelay', 'fieldGroupIds', 'blocked']);
const supported = new Set();
// explicitly named default aggregation == implicit children: always supported
const DEFAULT_AGG = {};
for (const [n, x] of Object.entries(c.controls)) for (const k of Object.keys(x.aggregations)) if (k.endsWith(' (default)')) (DEFAULT_AGG[n] ??= new Set()).add(k.replace(' (default)', ''));
// members deliberately added beyond the usage threshold (cheap on Web Components, frequent in samples-controls)
const MANUAL_ADD = `sap.m.MessageStrip.showCloseButton sap.m.MessageStrip@close sap.m.Image.alt sap.m.Image.decorative sap.m.List.growing sap.m.List.growingThreshold sap.m.List@delete sap.m.List@itemPress sap.m.List.includeItemInSelection
sap.m.StandardListItem.counter sap.m.StandardListItem@press sap.m.DatePicker.valueState sap.m.DatePicker.valueStateText sap.m.DatePicker@change sap.m.DatePicker.width sap.m.DatePicker.required
sap.m.DateTimePicker.value sap.m.DateTimePicker.valueFormat sap.m.DateTimePicker.displayFormat sap.m.DateTimePicker@change sap.m.DateTimePicker.valueState sap.m.DateTimePicker.valueStateText sap.m.DateTimePicker.placeholder sap.m.DateTimePicker.required sap.m.DateTimePicker.width
sap.m.ComboBox@change sap.m.ComboBox.width sap.m.ComboBox.valueState sap.m.ComboBox.valueStateText sap.m.ComboBox.showClearIcon sap.m.MultiComboBox.placeholder sap.m.MultiComboBox@selectionChange sap.m.MultiComboBox.valueState sap.m.MultiComboBox.valueStateText
sap.m.MultiInput.placeholder sap.m.MultiInput.value sap.m.MultiInput@change sap.m.MultiInput@tokenUpdate sap.m.MultiInput.valueState sap.m.Popover.showHeader sap.m.Popover.contentHeight sap.m.Popover@afterClose sap.m.Popover.modal
sap.m.Table@selectionChange sap.m.Table@itemPress sap.m.Table.alternateRowColors sap.m.Text.maxLines sap.m.Column.importance sap.m.StepInput.max sap.m.StepInput.step sap.m.StepInput.width sap.m.StepInput.enabled sap.m.StepInput.editable sap.m.StepInput.valueState sap.m.StepInput.displayValuePrecision sap.m.StepInput@change
sap.m.Select.valueState sap.m.Select.valueStateText sap.m.Select@liveChange sap.m.CheckBox.valueState sap.m.CheckBox.partiallySelected sap.m.CheckBox.required sap.m.CheckBox.wrapping sap.m.TextArea.maxLength sap.m.TextArea.valueState sap.m.TextArea.showExceededText sap.m.TextArea@liveChange
sap.m.Link.enabled sap.m.Link.emphasized sap.m.Link.wrapping sap.m.Link.icon sap.m.Link.endIcon sap.m.ObjectIdentifier.titleActive sap.m.ObjectIdentifier@titlePress sap.m.ObjectStatus.active sap.m.ObjectStatus@press sap.m.ObjectStatus.inverted
sap.m.Input.valueLiveUpdate sap.m.Input.showClearIcon sap.m.Input@suggestionItemSelected sap.m.Input@change sap.m.Panel@expand sap.m.Panel.stickyHeader sap.m.Dialog.showHeader sap.m.Dialog/customHeader sap.m.Dialog/footer sap.m.Dialog/subHeader
sap.m.SearchField.showRefreshButton sap.m.SearchField@suggest sap.m.IconTabFilter.enabled sap.m.IconTabFilter.design sap.m.IconTabBar.headerBackgroundDesign sap.m.ToggleButton.enabled sap.m.ToggleButton.type sap.m.OverflowToolbarButton.enabled
sap.m.SegmentedButtonItem.enabled sap.m.SegmentedButtonItem.width sap.m.SegmentedButton.width sap.m.SegmentedButton.enabled sap.m.Label.showColon sap.m.Label.textAlign sap.m.Title.textAlign sap.m.Text.textAlign sap.m.Text.emptyIndicatorMode
sap.m.HBox.width sap.m.HBox.height sap.m.VBox.wrap sap.m.FlexBox.gap sap.m.FlexBox.rowGap sap.m.FlexBox.columnGap sap.m.ProgressIndicator.width sap.m.ProgressIndicator.displayOnly sap.ui.core.Icon.alt sap.ui.core.Icon.width sap.m.StandardTreeItem.icon sap.m.Tree.mode sap.m.Tree@toggleOpenState sap.m.Tree/headerToolbar sap.m.Tree.sticky sap.m.Page.showFooter sap.m.Page.backgroundDesign sap.m.Page.titleLevel`.split(/\s+/);
for (const m of MANUAL_ADD) supported.add(m);
for (const [m, e] of Object.entries(mem)) {
  const [ctrl, , name] = splitM(m);
  if (!V1.has(ctrl)) continue;
  if (/^(if|then|else|elseif|repeat|with|dragDropConfig)$/.test(name)) continue;
  if (UNIVERSAL.has(name) || e.core >= 1 || e.controls >= 8) supported.add(m);
}
const isDef = (ctrl, kind, name) => kind === '/' && DEFAULT_AGG[ctrl]?.has(name);
const ok = (a, ctrlSet, memSet) => a.need.every((x) => ctrlSet.has(x)) && a.members.every((m) => { const [ctrl, kind, name] = splitM(m); return !ctrlSet.has(ctrl) || TOLERATED.has(ctrl) || UNIVERSAL.has(name) || isDef(ctrl, kind, name) || memSet.has(m); });

const SUP_BIND = new Set(['simple absolute {/PATH}', 'simple relative {PATH}', 'list/aggregation binding (attr)', 'string-composite(text + {..})', 'escaped-literal-brace', 'runtime-computed relative path (reconstructs as {})',
  'object-binding {path:..}', 'typed binding (type:)', 'formatOptions', 'composite parts:[..]', 'list-binding options', 'list-binding sorter', 'constraints', 'binding mode', 'targetType',
  'expression-binding {= }', 'expression-binding:function-call', 'named model: device>',
  'formatter ref', 'formatter=Formatter.DateAbapDateToDateObject', 'formatter=Formatter.DateAbapDateTimeToDateObject', 'formatter=Formatter.DateCreateObject',
  'type=sap.ui.model.type.Integer', 'type=sap.ui.model.type.Float', 'type=sap.ui.model.type.Currency', 'type=sap.ui.model.type.String', 'type=sap.ui.model.type.Date', 'type=sap.ui.model.type.DateTime', 'type=sap.ui.model.type.Time',
  'type=IntegerType', 'type=FloatType', 'type=CurrencyType', 'type=StringType', 'type=DateType', 'type=DateTimeType', 'type=TimeType']);
const SUP_ARG = new Set(['static literal', '${$parameters>/name}', '${$source>/prop}', '${REL_PATH} (row context)', '${/ABS_PATH}', 'literal JSON/template starting with { or $ (raw-evaluated)', 'non-literal (variable/expression)']);
const SUP_FA = new Set(['CONTROL_GLOBAL', 'POPUP_CLOSE', 'POPOVER_CLOSE', 'URLHELPER', 'OPEN_NEW_TAB', 'SET_FOCUS', 'SCROLL_TO', 'SCROLL_INTO_VIEW', 'START_TIMER', 'CLIPBOARD_COPY', 'DOWNLOAD_B64_FILE', 'SET_TITLE', 'SET_FAVICON', 'LOCATION_RELOAD', 'SYSTEM_LOGOUT', 'SET_SIZE_LIMIT', 'STORE_DATA', 'KEYBOARD_SHORTCUT', 'HASH_SET', 'HASH_REPLACE', 'HASH_BACK', 'HASH_ATTACH_CHANGED', 'HASH_ROUTING', 'APP_STATE_SET_ACTIVE', 'ROUNDTRIP_EVENT (follow_up_action( _event( ) ))']);
const SUP_API = new Set(['view_display', 'view_model_update', 'popup_display', 'popup_destroy', 'popup_model_update', 'popover_display', 'popover_destroy', 'popover_model_update', 'message_toast_display', 'message_box_display', 'nav_app_call', 'nav_app_leave', 'follow_up_action', 'get_event_arg', 'check_on_navigated', 'set_session_stateful']);

const report = (list) => {
  const n = list.length;
  const r = {};
  const ctrlOk = list.filter((a) => a.need.every((x) => V1.has(x)));
  r.controls = ctrlOk.length;
  const memOk = ctrlOk.filter((a) => ok(a, V1, supported));
  r.controlsAndMembers = memOk.length;
  const bindOk = memOk.filter((a) => a.bindings.every((b) => SUP_BIND.has(b)));
  r.plusBindings = bindOk.length;
  const argOk = bindOk.filter((a) => a.argKinds.every((b) => SUP_ARG.has(b)));
  r.plusEventArgs = argOk.length;
  const faOk = argOk.filter((a) => a.frontendActions.every((b) => SUP_FA.has(b)));
  r.plusFrontendActions = faOk.length;
  const apiOk = faOk.filter((a) => a.clientApi.every((b) => SUP_API.has(b)));
  r.plusClientApi = apiOk.length;
  r.pct = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round((1000 * v) / n) / 10]));
  // what kills apps at each stage
  const why = {};
  for (const a of ctrlOk) {
    if (!ok(a, V1, supported)) for (const m of a.members) { const [ctrl, , name] = splitM(m); if (V1.has(ctrl) && !TOLERATED.has(ctrl) && !UNIVERSAL.has(name) && !isDef(ctrl, splitM(m)[1], name) && !supported.has(m)) why['member ' + m] = (why['member ' + m] || 0) + 1; }
    for (const b of a.bindings) if (!SUP_BIND.has(b)) why['binding ' + b] = (why['binding ' + b] || 0) + 1;
    for (const b of a.argKinds) if (!SUP_ARG.has(b)) why['eventArg ' + b] = (why['eventArg ' + b] || 0) + 1;
    for (const b of a.frontendActions) if (!SUP_FA.has(b)) why['action ' + b] = (why['action ' + b] || 0) + 1;
    for (const b of a.clientApi) if (!SUP_API.has(b)) why['clientApi ' + b] = (why['clientApi ' + b] || 0) + 1;
  }
  r.blockersAmongControlCoveredApps = Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 30);
  return r;
};
const out = { core: report(core), samples: report(core.filter((a) => a.corpus === 'samples')), stack: report(core.filter((a) => a.corpus === 'stack')), addons: report(core.filter((a) => a.corpus === 'addons')), controls: report(ctl) };
// supported member table per control
const table = {};
for (const m of [...supported].sort()) { const [ctrl, kind, name] = splitM(m); const t = (table[ctrl] ??= { properties: [], aggregations: [], events: [] }); const e = mem[m]; const label = `${name} (${e.core}/${e.controls})`; (kind === '.' ? t.properties : kind === '@' ? t.events : t.aggregations).push(label); }
out.supportedMembers = table;
out.rules = { universal: [...UNIVERSAL], tolerated: [...TOLERATED], memberThreshold: 'used by >=1 core app or >=8 samples-controls apps', SUP_BIND: [...SUP_BIND], SUP_ARG: [...SUP_ARG], SUP_FA: [...SUP_FA], SUP_API: [...SUP_API] };
// member usage table for all members of v1 controls not supported (for exclusions)
const excluded = {};
for (const [m, e] of Object.entries(mem)) { const [ctrl, kind, name] = splitM(m); if (V1.has(ctrl) && !supported.has(m) && !UNIVERSAL.has(name) && !isDef(ctrl, kind, name)) (excluded[ctrl] ??= []).push(`${kind}${name} (${e.core}/${e.controls})`); }
out.unsupportedMembersOfV1Controls = excluded;
out.memberUsage = mem;
fs.writeFileSync(process.argv[3] || 'features.json', JSON.stringify(out, null, 1));
for (const k of ['core', 'samples', 'stack', 'addons', 'controls']) console.log(k, JSON.stringify(out[k].pct));
console.log(JSON.stringify(out.core.blockersAmongControlCoveredApps));
console.log(JSON.stringify(out.controls.blockersAmongControlCoveredApps.slice(0, 15)));
