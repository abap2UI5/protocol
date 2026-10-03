#!/usr/bin/env node
/*
 * Build profiles/portable-v1.json - the machine-readable portable view
 * profile v1 - from the census proposal (portable-proposal.md, produced by
 * the portable-profile census; method in profiles/portable.md section 10).
 *
 *   node scripts/gen-portable-profile.mjs <path to portable-proposal.md>
 *
 * The control list (section 3 of the proposal: controls, their v1 members,
 * the Web Component mapping and the members left out) is parsed; the binding
 * forms, event-argument descriptors, event parameters and frontend actions
 * are the normative decisions of profiles/portable.md, written out below.
 * test/portable.test.mjs holds profiles/portable.md and this file to each
 * other and validates the output against schema/portable-profile.schema.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) {
  process.stderr.write("usage: node scripts/gen-portable-profile.mjs <portable-proposal.md>\n");
  process.exit(2);
}
const md = fs.readFileSync(src, "utf8");

const section = (title) => {
  const start = md.indexOf(`\n## ${title}`);
  if (start < 0) throw new Error(`no section "${title}"`);
  const end = md.indexOf("\n## ", start + 4);
  return md.slice(start, end < 0 ? undefined : end);
};

/** "a (1/2), b (0/8)" -> [{ name, core, controls }] */
function members(text) {
  const t = text.replace(/\(default aggregation:[^)]*\)/, "").trim();
  if (t === "-" || t === "") return [];
  return t.split(/,\s*/).map((m) => {
    const x = /^([A-Za-z][\w]*)\s*\((\d+)\/(\d+)\)$/.exec(m.trim());
    if (!x) throw new Error(`cannot read member "${m}"`);
    return { name: x[1], core: Number(x[2]), controls: Number(x[3]) };
  });
}

const KIND = { ".": "property", "/": "aggregation", "@": "event" };
function excluded(text) {
  return text.split(/,\s*/).map((m) => m.trim()).filter((m) => /^[./@]/.test(m)).map((m) => {
    const x = /^([./@])([A-Za-z]\w*)\s*\((\d+)\/(\d+)\)$/.exec(m);
    if (!x) throw new Error(`cannot read excluded member "${m}"`);
    return { kind: KIND[x[1]], name: x[2], core: Number(x[3]), controls: Number(x[4]) };
  });
}

const controls = {};
const s3 = section("3. Control list v1");
let category = "";
for (const block of s3.split("\n### ").slice(1)) {
  category = block.split("\n")[0].trim();
  const usage = {};
  for (const row of block.matchAll(/^\| (sap\.[\w.]+) \| (\d+) \| (\d+) \| (.+?) \| (\w+) \|$/gm)) {
    usage[row[1]] = { core: Number(row[2]), controls: Number(row[3]), webComponent: row[4], fit: row[5] };
  }
  for (const entry of block.split("\n**").slice(1)) {
    const name = /^(sap\.[\w.]+)\*\*/.exec(entry)[1];
    const line = (key) => {
      const m = new RegExp(`^- ${key}: (.*)$`, "m").exec(entry);
      return m ? m[1] : "";
    };
    const aggText = line("aggregations");
    const def = /\(default aggregation: (\w+)/.exec(aggText);
    const u = usage[name];
    if (!u) throw new Error(`${name} is missing from its category table`);
    controls[name] = {
      category,
      tolerated: category.startsWith("Tolerated"),
      usage: { coreApps: u.core, samplesControlsApps: u.controls },
      properties: members(line("properties")),
      aggregations: members(aggText),
      ...(def ? { defaultAggregation: def[1] } : {}),
      events: members(line("events")),
      webComponent: u.webComponent.replace(/`/g, ""),
      fit: u.fit,
      mapping: line("mapping"),
      notInV1: excluded(line("not in v1")),
    };
  }
}

const v11 = [];
for (const row of section("9. v1.1 candidates").matchAll(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)) {
  if (/^family$|^---/.test(row[1].trim())) continue;
  v11.push({
    family: row[1].trim(), controls: row[2].trim(), coreAppsBlocked: row[3].trim(),
    webComponent: row[4].trim().replace(/`/g, ""), note: row[5].trim(),
  });
}

const profile = {
  $schema: "../schema/portable-profile.schema.json",
  profile: "portable",
  version: 1,
  status: "normative - profiles/portable.md is the text this file is generated for",
  generatedFrom: "the portable-profile census (2026-10-03): @abap2ui5/linter 0.8.5 view reconstruction over abap2UI5/samples, samples-stack, the addons and real-world apps (247 core apps) and samples-controls (642 ports)",
  documentRoots: ["sap.ui.core.mvc.View", "sap.ui.core.FragmentDefinition"],
  slots: { required: ["MAIN", "POPUP", "POPOVER"], notInV1: ["NEST", "NEST2"] },
  namespaces: ["sap.m", "sap.ui.core", "sap.ui.core.mvc", "sap.ui.layout", "sap.ui.layout.form", "sap.tnt"],
  universalAttributes: ["id", "class", "visible", "tooltip", "busy", "busyIndicatorDelay", "fieldGroupIds", "binding", "layoutData", "customData", "dependents"],
  cssHelperClassPattern: "^sapUi(Tiny|Small|Medium|Large)?(Margin|Padding)(Top|Bottom|Begin|End|BeginEnd|TopBottom)?$|^sapUiContentPadding$|^sapUiResponsiveMargin$|^sapUiNoMargin|^sapUiNoContentPadding$",
  controls,
  bindingForms: {
    allowed: [
      { form: "absolute-path", example: "{/MV_VALUE}", note: "two-way for value-like properties" },
      { form: "list-binding", example: "items=\"{/T_TAB}\" + one template child" },
      { form: "relative-path", example: "{TITLE}", note: "inside a template or an element binding" },
      { form: "object-binding", example: "{path:'/T_TAB', templateShareable:false}", keys: ["path", "parts", "type", "formatOptions", "constraints", "formatter", "targetType", "mode", "sorter", "templateShareable", "length", "startIndex"] },
      { form: "string-composite", example: "{/MV_PERCENT} %" },
      { form: "expression", example: "{= ${/QUANTITY} > 500 }", grammar: "restricted - see expressionGrammar" },
      { form: "escaped-braces", example: "\\{ color:red \\}" },
      { form: "typed", example: "{path:'/AMOUNT', type:'sap.ui.model.type.Integer'}", types: ["String", "Integer", "Float", "Currency", "Date", "Time", "DateTime"].map((t) => `sap.ui.model.type.${t}`) },
      { form: "parts", example: "{parts:['/AMOUNT','/CURRENCY'], type:'sap.ui.model.type.Currency'}" },
      { form: "formatter", example: "formatter: 'Formatter.DateAbapDateToDateObject'", formatters: ["Formatter.DateCreateObject", "Formatter.DateAbapDateToDateObject", "Formatter.DateAbapDateTimeToDateObject"] },
      { form: "device-model", example: "{device>/system/phone}", paths: ["/system/phone", "/system/tablet", "/system/desktop", "/resize/width", "/resize/height", "/support/touch", "/orientation/portrait", "/orientation/landscape"] },
    ],
    formatOptions: ["minFractionDigits", "maxFractionDigits", "minIntegerDigits", "maxIntegerDigits", "groupingEnabled", "decimals", "style", "pattern", "source.pattern", "showMeasure", "showNumber", "currencyCode", "preserveDecimals", "UTC"],
    constraints: ["minimum", "maximum", "minLength", "maxLength"],
    expressionGrammar: {
      references: ["${/absolute}", "${relative}", "${device>/path}"],
      literals: ["string", "number", "boolean", "null"],
      operators: ["!", "&&", "||", "?:", "===", "!==", "==", "!=", "<", "<=", ">", ">=", "+", "-", "*", "/", "%", "( )"],
      members: [".length"],
      functions: ["Math.max", "Math.min", "Math.abs", "Math.round", "Math.floor", "Math.ceil", ".toUpperCase()", ".toLowerCase()", ".trim()", ".indexOf()", ".includes()", ".startsWith()"],
    },
    excluded: ["named models other than device> (XML templating variables, meta>, i18n>)", "sap.ui.model.odata.type.*", "app formatter functions and Formatter.expandInlineIcons", "core:require type aliases", "expressions beyond expressionGrammar (RegExp, odata.*, encodeURIComponent, arbitrary JS)"],
  },
  eventWires: {
    allowed: [
      { wire: ".eB(['EVENT'], arg...)", from: "client->_event( )" },
      { wire: ".eB(['___ZZZ_NAL'])", from: "client->_event_nav_app_leave( )" },
      { wire: ".eF('ACTION', arg...)", from: "client->_event_client( ) / a wired follow_up_action( )", note: "only the frontend actions of actions.wire.custom and actions.wire.customGlobals" },
      { wire: ".eBP($event, true, ['EVENT'], arg...)", from: "s_ctrl-check_prevent_default" },
      { wire: "['EVENT', false, false, false, queueLast, noBusy]", from: "s_ctrl-check_queue_last / check_no_busy" },
      { wire: "quoted arguments", from: "s_ctrl-check_arg_literal" },
    ],
    excluded: ["s_ctrl-prevent_default_expr (.eBP with an expression over control objects)"],
  },
  eventArgDescriptors: {
    allowed: [
      { descriptor: "'literal'", meaning: "a constant string" },
      { descriptor: "${REL_PATH}", meaning: "a field of the binding context (row) of the control that fired" },
      { descriptor: "${/ABS_PATH}", meaning: "the current model value" },
      { descriptor: "${$source>/prop}", meaning: "a v1 property of the control that fired" },
      { descriptor: "${$parameters>/name}", meaning: "an event parameter of the closed list eventParameters" },
      { descriptor: "JSON / message template", meaning: "an argument starting with { or $ passed through as data (only meaningful for frontend actions)" },
    ],
    excluded: ["method calls on event objects (${$parameters>/selectedItem}.getKey(), .getBindingContext().getPath(), ...)", "$event.* (the raw UI5 event)", "$controller.* helpers", "parameters that are UI5 objects (item, listItem, selectedItem, column, ...)"],
  },
  eventParameters: {
    "sap.m.Input": { liveChange: ["value"], submit: ["value"], change: ["value"], suggest: ["suggestValue"] },
    "sap.m.TextArea": { liveChange: ["value"], change: ["value"] },
    "sap.m.SearchField": { search: ["query", "refreshButtonPressed", "clearButtonPressed"], liveChange: ["newValue"], suggest: ["suggestValue"] },
    "sap.m.CheckBox": { select: ["selected"] },
    "sap.m.Switch": { change: ["state"] },
    "sap.m.ToggleButton": { press: ["pressed"] },
    "sap.m.IconTabBar": { select: ["key", "selectedKey"] },
    "sap.m.DatePicker": { change: ["value", "valid"] },
    "sap.m.DateTimePicker": { change: ["value", "valid"] },
    "sap.m.StepInput": { change: ["value"] },
    "sap.m.MultiInput": { change: ["value"], tokenUpdate: ["type"] },
    "sap.m.MultiComboBox": { selectionChange: ["selected"] },
    "sap.m.Table": { selectionChange: ["selected"] },
    "sap.m.List": { selectionChange: ["selected"] },
    "sap.m.Panel": { expand: ["expand"] },
  },
  frontendActions: {
    allowed: [
      "SET_FOCUS", "START_TIMER", "DOWNLOAD_B64_FILE", "CLIPBOARD_COPY", "URLHELPER", "OPEN_NEW_TAB", "SCROLL_TO", "SCROLL_INTO_VIEW",
      "SET_TITLE", "SET_FAVICON", "LOCATION_RELOAD", "SYSTEM_LOGOUT", "STORE_DATA", "KEYBOARD_SHORTCUT", "PLAY_AUDIO",
      "SET_PUSH_STATE", "HASH_REPLACE", "HASH_BACK", "HASH_ATTACH_CHANGED", "SET_NAV_ROUTING", "SET_APP_STATE_ACTIVE", "SET_SIZE_LIMIT",
    ],
    allowedGlobals: {
      MESSAGE_TOAST: ["show"],
      MESSAGE_BOX: ["show", "alert", "confirm", "information", "warning", "error", "success"],
      BUSY_INDICATOR: ["show", "hide"],
      INVISIBLE_MESSAGE: ["announce"],
      THEMING: ["setTheme"],
      VIEW_SLOTS: ["destroy"],
    },
    noOpAllowed: ["SET_SIZE_LIMIT", "SET_PUSH_STATE", "HASH_REPLACE", "HASH_BACK", "HASH_ATTACH_CHANGED", "SET_NAV_ROUTING", "SET_APP_STATE_ACTIVE"],
    excluded: ["CONTROL_BY_ID", "BINDING_CALL", "BIND_ELEMENT", "SET_ODATA_MODEL", "SMART_VARIANT_INIT", "FILTER_BAR_VARIANT_INIT", "CROSS_APP_NAV_TO_EXT", "CROSS_APP_NAV_TO_PREV_APP", "SET_TITLE_LAUNCHPAD", "CONTROL_GLOBAL ICON_POOL", "CONTROL_GLOBAL POPUP", "CONTROL_GLOBAL FORMATTING"],
  },
  // revision 0.3 (open question 10): the client API's names and what a
  // renderer receives, apart. frontendActions.allowed stays the api list for
  // consumers of revision 0.2.
  actions: {
    note: "api: the follow_up_action( ) names (cs_event values) a portable app may call - frontendActions.allowed is the same list, kept for consumers of revision 0.2. wire: what a portable renderer actually receives - T_SYSTEM actions with their ROUTER options, and the T_CUSTOM / .eF names. The navigation family of api is folded by the backend into the one ROUTER system action (foldedIntoRouter) and never arrives under its own name.",
    api: [
      "SET_FOCUS", "START_TIMER", "DOWNLOAD_B64_FILE", "CLIPBOARD_COPY", "URLHELPER", "OPEN_NEW_TAB", "SCROLL_TO", "SCROLL_INTO_VIEW",
      "SET_TITLE", "SET_FAVICON", "LOCATION_RELOAD", "SYSTEM_LOGOUT", "STORE_DATA", "KEYBOARD_SHORTCUT", "PLAY_AUDIO",
      "SET_PUSH_STATE", "HASH_REPLACE", "HASH_BACK", "HASH_ATTACH_CHANGED", "SET_NAV_ROUTING", "SET_APP_STATE_ACTIVE", "SET_SIZE_LIMIT",
    ],
    wire: {
      system: { VIEW_SLOTS: ["display", "destroy"], ROUTER: ["sync"] },
      routerOptions: ["setNavRouting", "checkNavAppCall", "navAppCallPrevApp", "navAppCallPrevId", "setPushState", "setHashReplace", "setHashEvent", "setAppStateActive"],
      foldedIntoRouter: { SET_NAV_ROUTING: "setNavRouting", SET_PUSH_STATE: "setPushState", HASH_REPLACE: "setHashReplace", HASH_ATTACH_CHANGED: "setHashEvent", SET_APP_STATE_ACTIVE: "setAppStateActive" },
      custom: [
        "SET_FOCUS", "START_TIMER", "DOWNLOAD_B64_FILE", "CLIPBOARD_COPY", "URLHELPER", "OPEN_NEW_TAB", "SCROLL_TO", "SCROLL_INTO_VIEW",
        "SET_TITLE", "SET_FAVICON", "LOCATION_RELOAD", "SYSTEM_LOGOUT", "STORE_DATA", "KEYBOARD_SHORTCUT", "PLAY_AUDIO", "HASH_BACK", "SET_SIZE_LIMIT",
      ],
      customGlobals: {
        MESSAGE_TOAST: ["show"],
        MESSAGE_BOX: ["show", "alert", "confirm", "information", "warning", "error", "success"],
        BUSY_INDICATOR: ["show", "hide"],
        INVISIBLE_MESSAGE: ["announce"],
        THEMING: ["setTheme"],
        VIEW_SLOTS: ["destroy"],
      },
      noOpAllowed: ["ROUTER", "HASH_BACK", "SET_SIZE_LIMIT"],
    },
  },
  clientApi: {
    allowed: ["view_display", "popup_display", "popup_destroy", "popover_display", "popover_destroy", "message_toast_display", "message_box_display", "follow_up_action", "_event", "_event_client", "_event_nav_app_leave", "_bind", "_bind_edit", "nav_app_call", "nav_app_leave", "get_event_arg"],
    excluded: ["nest_view_display", "nest_view_destroy", "nest2_view_display", "nest2_view_destroy", "view_display( switch_default_model_path )"],
  },
  excludedNamespaces: ["sap.ui.comp", "sap.uxap", "sap.f", "sap.ui.table", "sap.ui.unified", "sap.suite", "sap.viz", "sap.gantt", "sap.ui.vbm", "sap.ui.vk", "sap.ui.codeeditor", "sap.ui.integration", "sap.ndc", "sap.ui.webc", "sap.ui.core.dnd", "sap.f.dnd", "sap.m.plugins", "z2ui5.cc", "http://www.w3.org/1999/xhtml", "http://schemas.sap.com/sapui5/extension/sap.ui.core.template/1"],
  v11Candidates: v11,
};

const out = path.join(ROOT, "profiles", "portable-v1.json");
fs.writeFileSync(out, `${JSON.stringify(profile, null, 2)}\n`);
const n = Object.values(controls);
process.stderr.write(`${path.relative(ROOT, out)}: ${n.filter((c) => !c.tolerated).length} rendered + ${n.filter((c) => c.tolerated).length} tolerated controls, ${v11.length} v1.1 candidates\n`);
