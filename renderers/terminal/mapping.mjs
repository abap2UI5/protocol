/*
 * The mapping of portable profile v1 (profiles/portable-v1.json) onto the
 * terminal - one entry per control: what it becomes on screen (`terminal`),
 * what is approximated or left out (`note`) and the render function, which
 * turns the control into blocks (layout.mjs draws them) and registers its
 * widgets (render.mjs `ctx.widget`). README.md's mapping table is generated
 * from this table (node scripts/render-terminal.mjs); a control of the
 * profile without an entry fails test/terminal.test.mjs.
 */
import {
  resolve, boundPath, text, truthy, falsy, children, aggregation, contentChildren, rowsOf, htmlToText, controlName,
} from "../common/view.mjs";
import { renderNode, renderList, asInline } from "./render.mjs";
import { clean } from "./text.mjs";

const attr = (node, name, ctx) => resolve(node.attrs[name], ctx);
/** A property as one line of text, safe for the terminal. */
const str = (node, name, ctx) => clean(text(attr(node, name, ctx)), { keepNewlines: false });
/** A property as text that may span lines. */
const para = (node, name, ctx) => clean(text(attr(node, name, ctx)));
const has = (node, name) => node.attrs[name] !== undefined;

const tb = (t, style) => ({ t: "text", text: t, ...(style ? { style } : {}) });
const inline = (items) => ({ t: "inline", items });

/** Short text stand-ins for the icons views use most; any other icon is
 *  shown by its name. */
export const ICON_TEXT = {
  "nav-back": "<", "navigation-left-arrow": "<", "navigation-right-arrow": ">", "slim-arrow-left": "<", "slim-arrow-right": ">",
  "add": "+", "less": "-", "decline": "x", "sys-cancel": "x", "accept": "ok", "sys-enter": "ok", "sys-enter-2": "ok",
  "delete": "del", "edit": "edit", "save": "save", "search": "find", "refresh": "reload", "copy": "copy", "download": "down",
  "upload": "up", "settings": "settings", "action-settings": "settings", "filter": "filter", "sort": "sort", "home": "home",
  "message-error": "!", "error": "!", "message-warning": "!", "alert": "!", "message-success": "ok", "message-information": "i",
  "information": "i", "hint": "i", "question-mark": "?", "favorite": "*", "unfavorite": "*", "menu2": "menu", "overflow": "...",
  "display": "show", "detail-view": "show", "email": "mail", "phone": "tel", "calendar": "date", "date-time": "date",
  "person-placeholder": "user", "employee": "user", "log": "logout", "cart": "cart", "print": "print", "attachment": "file",
};

const iconId = (src) => (src ? String(src).replace(/^sap-icon:\/\/(?:[^/]+\/)?/, "") : "");
/** The text of an icon (`sap-icon://add` -> "+"). */
export const iconText = (src) => {
  const id = iconId(src);
  return id ? (ICON_TEXT[id] || id) : "";
};

const STATE_STYLE = { Error: "red", Warning: "yellow", Success: "green", Information: "blue", Indication01: "red", Indication02: "red", Indication03: "yellow", Indication04: "green", Indication05: "blue" };
const BUTTON_STYLE = { Emphasized: "bold", Accept: "green", Success: "green", Reject: "red", Negative: "red", Critical: "yellow", Attention: "yellow" };

/** A disabled or read-only control: drawn, not focusable. */
function locked(node, ctx) {
  for (const p of ["enabled", "editable"]) if (has(node, p) && falsy(attr(node, p, ctx))) return true;
  return false;
}

/** Children side by side: one line of inline items when every child fits on
 *  a line (texts, buttons, fields), else columns. */
function row(nodes, ctx) {
  const parts = nodes.map((n) => renderNode(n, ctx)).filter((b) => b.length);
  if (!parts.length) return [];
  const inl = parts.map(asInline);
  if (inl.every(Boolean)) return [inline(inl.flat())];
  if (parts.length === 1) return parts[0];
  return [{ t: "cols", cols: parts }];
}

/** A stack of children. */
const stack = (node, ctx) => renderList(contentChildren(node), ctx);

/** A control that is text unless it has a press wire: then a link. */
function pressable(node, ctx, event, label, block, { active = true } = {}) {
  if (!active || !has(node, event) || !ctx.interactive) return block ? [block] : [];
  const w = ctx.widget({ kind: "link", label, node, press: { name: event } });
  return [inline([{ widget: w }])];
}

function button(node, ctx) {
  const label = str(node, "text", ctx) || str(node, "tooltip", ctx) || iconText(str(node, "icon", ctx)) || "(button)";
  const icon = str(node, "text", ctx) && ICON_TEXT[iconId(str(node, "icon", ctx))];
  const enabled = !has(node, "enabled") || !falsy(attr(node, "enabled", ctx));
  const w = ctx.widget({
    kind: "button", label: icon ? `${icon} ${label}` : label, node, enabled: enabled && has(node, "press"), press: { name: "press" },
    style: BUTTON_STYLE[str(node, "type", ctx)],
  });
  // neighbouring buttons share a line, as inline-block buttons do in UI5
  return [{ ...inline([{ widget: w }]), merge: true }];
}

/** An input bound by `prop`: { value, path } plus the widget spec. */
function field(node, ctx, prop, spec) {
  const value = attr(node, prop, ctx);
  return ctx.widget({ node, path: boundPath(node.attrs[prop], ctx), value, enabled: !locked(node, ctx), placeholder: str(node, "placeholder", ctx) || undefined, ...spec });
}

/** The options of a Select-like control: its items (list binding or static). */
function options(node, ctx, agg = "items") {
  return rowsOf(node, agg, ctx).map(({ base, node: item }) => {
    const c = ctx.with(base);
    const key = str(item, "key", c);
    const t = str(item, "text", c);
    return { key: key || t, text: t || key };
  });
}

function choice(node, ctx, { prop, variant, multi = false, change, params }) {
  const opts = options(node, ctx);
  const raw = attr(node, prop, ctx);
  const value = multi ? (Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",").filter(Boolean)) : text(raw);
  // without options the key is edited as text
  const w = opts.length
    ? field(node, ctx, prop, { kind: "choice", variant, options: opts, value, multi, change, params })
    : field(node, ctx, prop, { kind: "input", value: text(raw), change, params });
  return [inline([{ widget: w }])];
}

function toggle(node, ctx, prop, { variant, label, event, param, on, off }) {
  const w = field(node, ctx, prop, { kind: "toggle", variant, label, value: truthy(attr(node, prop, ctx)), change: event, params: (v) => ({ [param]: v }), on, off });
  return [inline([{ widget: w }])];
}

const SELECTABLE = new Set(["MultiSelect", "SingleSelect", "SingleSelectLeft", "SingleSelectMaster"]);

/** The press of a row: the item's own wire, or the list's row event. */
function rowPress(list, item) {
  if (has(item, "press")) return { name: "press", target: item };
  if (has(list, "itemPress")) return { name: "itemPress", target: list };
  return null;
}

/** The leading widgets of a row: its action and its selection toggle. */
function rowWidgets(list, item, rc, index, ctx) {
  const press = ctx.interactive ? rowPress(list, item) : null;
  const action = press ? rc.widget({ kind: "row", label: `row ${index + 1}`, node: item, press }) : null;
  let select = null;
  if (SELECTABLE.has(str(list, "mode", ctx)) && has(item, "selected")) {
    select = rc.widget({ kind: "toggle", variant: "check", label: "", node: item, path: boundPath(item.attrs.selected, rc), value: truthy(attr(item, "selected", rc)), change: has(list, "selectionChange") ? "selectionChange" : undefined, changeNode: list, params: (v) => ({ selected: v }) });
  }
  return { action, select };
}

function table(node, ctx) {
  const out = [];
  if (has(node, "headerText")) out.push(tb(str(node, "headerText", ctx), "bold"));
  out.push(...renderList(aggregation(node, "headerToolbar"), ctx), ...renderList(aggregation(node, "infoToolbar"), ctx));
  const cols = aggregation(node, "columns").filter((c) => !has(c, "visible") || !falsy(attr(c, "visible", ctx)));
  const header = cols.map((c) => aggregation(c, "header").map((h) => str(h, "text", ctx)).join(" "));
  const rows = rowsOf(node, "items", ctx);
  if (!rows.length) {
    out.push(tb(str(node, "noDataText", ctx) || "No data", "dim"));
    return out;
  }
  const built = rows.map(({ base, node: item, index }) => {
    const rc = ctx.with(base);
    const { action, select } = rowWidgets(node, item, rc, index, ctx);
    return { action, select, cells: aggregation(item, "cells").map((cell) => renderNode(cell, rc)) };
  });
  out.push({ t: "table", header: header.some(Boolean) ? header : null, rows: built });
  return out;
}

/** The nodes of a tree binding, depth first: every array-valued property of
 *  a node is its children (the UI5 JSONModel tree binding). */
function treeRows(node, ctx) {
  const binding = node.attrs.items;
  const template = aggregation(node, "items")[0];
  const p = binding !== undefined ? boundPath(binding, ctx) : null;
  if (!p || !template) return rowsOf(node, "items", ctx).map((r) => ({ ...r, depth: 0 }));
  const out = [];
  const visit = (path, depth) => {
    const data = resolve(`{${path}}`, ctx);
    if (!Array.isArray(data)) return;
    data.forEach((entry, i) => {
      const base = `${path}/${i}`;
      out.push({ base, node: template, index: out.length, depth });
      const kids = entry && typeof entry === "object" ? Object.keys(entry).find((k) => Array.isArray(entry[k])) : null;
      if (kids) visit(`${base}/${kids}`, depth + 1);
    });
  };
  visit(p, 0);
  return out;
}

function list(node, ctx, { tree = false } = {}) {
  const out = [];
  if (has(node, "headerText")) out.push(tb(str(node, "headerText", ctx), "bold"));
  out.push(...renderList(aggregation(node, "headerToolbar"), ctx));
  const rows = tree ? treeRows(node, ctx) : rowsOf(node, "items", ctx).map((r) => ({ ...r, depth: 0 }));
  if (!rows.length) {
    out.push(tb(str(node, "noDataText", ctx) || "No data", "dim"));
    return out;
  }
  const built = rows.map(({ base, node: item, index, depth }) => {
    const rc = ctx.with(base);
    const { action, select } = rowWidgets(node, item, rc, index, ctx);
    if (controlName(item) === "sap.m.CustomListItem") return { action, select, cells: [renderList(contentChildren(item), rc)] };
    const icon = iconText(str(item, "icon", rc));
    const title = `${"  ".repeat(depth)}${icon ? `(${icon}) ` : ""}${str(item, "title", rc)}`;
    const cells = [[tb(title)]];
    const description = str(item, "description", rc);
    const info = str(item, "info", rc);
    if (description) cells.push([tb(description, "dim")]);
    if (info) cells.push([tb(info, STATE_STYLE[str(item, "infoState", rc)])]);
    const counter = str(item, "counter", rc);
    if (counter && counter !== "0") cells.push([tb(counter, "dim")]);
    return { action, select, cells };
  });
  out.push({ t: "table", header: null, plain: true, rows: built });
  return out;
}

function inputEvents(node, ctx, names) {
  return names.filter((n) => has(node, n));
}

/** A dialog-like control: a frame with its title, content and buttons. */
function frame(node, ctx, { buttons }) {
  const custom = aggregation(node, "customHeader");
  const blocks = [];
  if (custom.length) blocks.push(...renderList(custom, ctx));
  blocks.push(...renderList(aggregation(node, "subHeader"), ctx), ...renderList(aggregation(node, "content"), ctx));
  const btn = asInline(renderList(children(node, buttons), ctx)) || [];
  if (btn.length) blocks.push({ t: "blank" }, inline([{ spacer: true }, ...btn]));
  blocks.push(...renderList(aggregation(node, "footer"), ctx));
  return [{ t: "box", title: custom.length ? null : (str(node, "title", ctx) || null), blocks }];
}

/*
 * The table: control -> { terminal, note, render }. `terminal` and `note`
 * are what README.md shows.
 */
export const CONTROLS = {
  // --------------------------------------------------- layout & containers
  "sap.m.Page": {
    terminal: "a header line (nav button, title, header content on the right) over a rule, then the content and the footer",
    note: "`showNavButton` + `navButtonPress` -> the button `[ < ]` that raises the wired event (the reserved `___ZZZ_NAL` for `_event_nav_app_leave`); Alt+Left presses it when the history has no entry to go back to",
    render(node, ctx) {
      const custom = aggregation(node, "customHeader");
      const head = [];
      let nav = null;
      if (truthy(attr(node, "showNavButton", ctx)) && has(node, "navButtonPress")) {
        nav = ctx.widget({ kind: "button", label: "<", node, press: { name: "navButtonPress" }, nav: true });
        head.push({ widget: nav });
      }
      const showHeader = !falsy(attr(node, "showHeader", ctx) ?? true);
      const title = showHeader && !custom.length ? str(node, "title", ctx) : "";
      if (title) head.push({ text: title, style: "bold" });
      const blocks = [];
      if (custom.length) blocks.push(...renderList(custom, ctx));
      // the header content stands right in the header line, as in UI5's title bar
      const headerContent = renderList(aggregation(node, "headerContent"), ctx);
      const right = head.length ? asInline(headerContent) : null;
      if (right && right.length) head.push({ spacer: true }, ...right);
      else blocks.push(...headerContent);
      blocks.push(...renderList(aggregation(node, "subHeader"), ctx));
      blocks.push(...renderList(aggregation(node, "content"), ctx));
      const footer = renderList(aggregation(node, "footer"), ctx);
      return [{ t: "page", title: title || null, header: head, blocks, footer }];
    },
  },
  "sap.m.Shell": { terminal: "(none) - its app renders in place", note: "", render: stack },
  "sap.m.VBox": { terminal: "a stack", note: "flexbox alignment ignored", render: stack },
  "sap.ui.layout.form.SimpleForm": {
    terminal: "label-field rows, the labels in one column",
    note: "a Label followed by a field becomes one row; several fields after one label share the row; the grid layout properties are ignored",
    render(node, ctx) {
      const out = [];
      if (has(node, "title")) out.push({ t: "heading", text: str(node, "title", ctx) });
      else out.push(...renderList(aggregation(node, "title"), ctx));
      out.push(...formRows(aggregation(node, "content"), ctx));
      return out;
    },
  },
  "sap.m.HBox": { terminal: "one line of inline items, or columns side by side (stacked when they do not fit the width)", note: "", render: (node, ctx) => row(contentChildren(node), ctx) },
  "sap.m.Panel": {
    terminal: "a frame titled by `headerText`",
    note: "`expandable`/`expanded` ignored - the content is always shown; `expand` not raised",
    render: (node, ctx) => [{ t: "box", title: str(node, "headerText", ctx) || null, blocks: [...renderList(aggregation(node, "headerToolbar"), ctx), ...renderList(aggregation(node, "content"), ctx)] }],
  },
  "sap.ui.layout.Grid": { terminal: "a stack", note: "spans ignored - children stack", render: stack },
  "sap.m.FlexBox": {
    terminal: "a stack (direction Column) or a line / columns (Row, the default)",
    note: "alignment, gaps and wrap ignored",
    render: (node, ctx) => (/^Column/.test(str(node, "direction", ctx)) ? stack(node, ctx) : row(contentChildren(node), ctx)),
  },
  "sap.m.ScrollContainer": { terminal: "a stack", note: "the screen scrolls as a whole", render: stack },
  "sap.m.IconTabFilter": {
    terminal: "a heading with the tab text (and count), its content below",
    note: "",
    render(node, ctx) {
      const title = str(node, "text", ctx) || str(node, "key", ctx);
      const count = str(node, "count", ctx);
      return [{ t: "heading", text: count ? `${title} (${count})` : title }, ...renderList(aggregation(node, "content"), ctx)];
    },
  },
  "sap.m.IconTabBar": {
    terminal: "every tab stacked, each under its heading",
    note: "`selectedKey` ignored - all tabs are shown; `select` not raised (reported)",
    render(node, ctx) {
      if (has(node, "select") && ctx.interactive) ctx.report(node, "event select is not raised - every tab is shown");
      return [...renderList(aggregation(node, "items"), ctx), ...renderList(aggregation(node, "content"), ctx)];
    },
  },
  "sap.ui.layout.VerticalLayout": { terminal: "a stack", note: "", render: stack },
  "sap.ui.core.Title": { terminal: "a heading (bold)", note: "", render: (node, ctx) => [{ t: "heading", text: str(node, "text", ctx) }] },
  "sap.ui.layout.HorizontalLayout": { terminal: "a line / columns (as HBox)", note: "", render: (node, ctx) => row(contentChildren(node), ctx) },

  // ------------------------------------------------------ toolbars & bars
  "sap.m.OverflowToolbar": { terminal: "one line of inline items (wrapped when too wide)", note: "no overflow menu - everything is shown; a ToolbarSpacer pushes what follows to the right", render: (node, ctx) => row(contentChildren(node), ctx) },
  "sap.m.ToolbarSpacer": { terminal: "the flexible space of its toolbar line", note: "", render: () => [inline([{ spacer: true }])] },
  "sap.m.Toolbar": { terminal: "one line of inline items (wrapped when too wide)", note: "as OverflowToolbar", render: (node, ctx) => row(contentChildren(node), ctx) },
  "sap.m.Bar": {
    terminal: "one line: contentLeft, contentMiddle, contentRight",
    note: "",
    render(node, ctx) {
      const parts = ["contentLeft", "contentMiddle", "contentRight"].map((a) => asInline(renderList(aggregation(node, a), ctx)) || []);
      const items = [...parts[0], { spacer: true }, ...parts[1], { spacer: true }, ...parts[2]];
      return items.some((i) => !i.spacer) ? [inline(items)] : [];
    },
  },
  "sap.m.OverflowToolbarButton": { terminal: "a button `[ text ]`", note: "as Button", render: button },

  // -------------------------------------------------------------- display
  "sap.m.Text": {
    terminal: "text, wrapped at the width",
    note: "`maxLines` cuts after that many lines (with an ellipsis)",
    render: (node, ctx) => [{ t: "text", text: para(node, "text", ctx), ...(has(node, "maxLines") ? { maxLines: Number(attr(node, "maxLines", ctx)) || undefined } : {}) }],
  },
  "sap.m.Label": { terminal: "bold text - or the label column of the field that follows", note: "", render: (node, ctx) => [tb(str(node, "text", ctx), "bold")] },
  "sap.m.Title": { terminal: "a heading (bold)", note: "", render: (node, ctx) => [{ t: "heading", text: str(node, "text", ctx) }] },
  "sap.m.ObjectStatus": {
    terminal: "text \"title: text\", colored by `state`",
    note: "`active` + `press` -> a link",
    render(node, ctx) {
      const t = [str(node, "title", ctx), str(node, "text", ctx)].filter(Boolean).join(": ");
      return pressable(node, ctx, "press", t, tb(t, STATE_STYLE[str(node, "state", ctx)]), { active: truthy(attr(node, "active", ctx)) });
    },
  },
  "sap.m.Link": {
    terminal: "a link `[text]` (press wire), else underlined text with the `href`",
    note: "a terminal does not open URLs - the `href` is shown",
    render(node, ctx) {
      const t = str(node, "text", ctx);
      const enabled = !has(node, "enabled") || !falsy(attr(node, "enabled", ctx));
      if (has(node, "press") && enabled) return pressable(node, ctx, "press", t || "(link)", tb(t, "underline"));
      const href = str(node, "href", ctx);
      return [tb(href && href !== t ? `${t || href}${t ? ` <${href}>` : ""}` : t, "underline")];
    },
  },
  "sap.m.ObjectIdentifier": {
    terminal: "the title (bold) and the text (dim) below it",
    note: "`titleActive` + `titlePress` -> a link",
    render(node, ctx) {
      const title = str(node, "title", ctx);
      const out = title ? pressable(node, ctx, "titlePress", title, tb(title, "bold"), { active: truthy(attr(node, "titleActive", ctx)) }) : [];
      const t = str(node, "text", ctx);
      if (t) out.push(tb(t, "dim"));
      return out;
    },
  },
  "sap.ui.core.HTML": {
    terminal: "the text of the HTML",
    note: "tags, `<style>` and `<script>` dropped - reported as approximated",
    render(node, ctx) {
      const t = clean(htmlToText(text(attr(node, "content", ctx))));
      if (t) ctx.report(node, "HTML rendered as plain text");
      return t ? [tb(t)] : [];
    },
  },
  "sap.ui.core.Icon": {
    terminal: "a short text in parentheses (`sap-icon://add` -> `(+)`, other icons by name); a button when it has a press wire",
    note: "the table of short texts is `ICON_TEXT` in mapping.mjs",
    render(node, ctx) {
      const t = iconText(str(node, "src", ctx));
      const label = str(node, "alt", ctx) || str(node, "tooltip", ctx) || t;
      if (has(node, "press") && ctx.interactive) return [inline([{ widget: ctx.widget({ kind: "button", label: label || "(icon)", node, press: { name: "press" } }) }])];
      return t ? [tb(`(${t})`, "dim")] : [];
    },
  },
  "sap.m.ObjectNumber": { terminal: "text \"number unit\", colored by `state`", note: "`emphasized` -> bold", render: (node, ctx) => [tb([str(node, "number", ctx), str(node, "unit", ctx)].filter(Boolean).join(" "), [STATE_STYLE[str(node, "state", ctx)], truthy(attr(node, "emphasized", ctx) ?? true) ? "bold" : ""].filter(Boolean).join(" ") || undefined)] },
  "sap.tnt.InfoLabel": { terminal: "text in parentheses", note: "`colorScheme` ignored", render: (node, ctx) => [tb(`(${str(node, "text", ctx)})`, "cyan")] },
  "sap.m.ProgressIndicator": {
    terminal: "a bar `[#####-----] 50 %` (`displayValue` when set)",
    note: "",
    render(node, ctx) {
      const pct = Math.max(0, Math.min(100, Number(attr(node, "percentValue", ctx)) || 0));
      return [{ t: "bar", percent: pct, label: str(node, "displayValue", ctx) || `${pct} %`, style: STATE_STYLE[str(node, "state", ctx)] }];
    },
  },
  "sap.m.Image": {
    terminal: "`[image: alt]` - a link when it has a press wire",
    note: "a terminal shows no images",
    render(node, ctx) {
      const label = `image: ${str(node, "alt", ctx) || str(node, "tooltip", ctx) || str(node, "src", ctx).replace(/^data:([^;,]*).*$/, "data $1")}`;
      if (has(node, "press") && ctx.interactive) return [inline([{ widget: ctx.widget({ kind: "link", label, node, press: { name: "press" } }) }])];
      return [tb(`[${label}]`, "dim")];
    },
  },

  // ---------------------------------------------------------------- input
  "sap.m.Input": {
    terminal: "an editable field `[value____]` (masked for type Password), edited in place",
    note: "Enter raises `submit` (`${$parameters>/value}`), F4 raises `valueHelpRequest` when `showValueHelp`; `change` and `liveChange` are raised once when the edit is committed (leaving the field, Enter) - not per keystroke; disabled or not editable -> not focusable",
    render(node, ctx) {
      const type = str(node, "type", ctx);
      const w = field(node, ctx, "value", {
        kind: "input", value: text(attr(node, "value", ctx)), password: type === "Password", numeric: type === "Number",
        maxLength: Number(attr(node, "maxLength", ctx)) || undefined,
        change: inputEvents(node, ctx, ["change", "liveChange"]), submit: has(node, "submit") ? "submit" : undefined,
        valueHelp: truthy(attr(node, "showValueHelp", ctx)) && has(node, "valueHelpRequest") ? "valueHelpRequest" : undefined,
        params: (v) => ({ value: v, newValue: v }),
      });
      return [inline([{ widget: w }])];
    },
  },
  "sap.m.TextArea": {
    terminal: "a multi-line field (`rows` lines high, growing with the text)",
    note: "Enter inserts a line feed; `change`/`liveChange` raised once when the edit is committed",
    render(node, ctx) {
      const w = field(node, ctx, "value", { kind: "input", multiline: true, rows: Number(attr(node, "rows", ctx)) || 2, value: text(attr(node, "value", ctx)), change: inputEvents(node, ctx, ["change", "liveChange"]), params: (v) => ({ value: v }) });
      return [inline([{ widget: w }])];
    },
  },
  "sap.ui.core.Item": { terminal: "an option (`key`, `text`) of its Select/ComboBox", note: "", render: (node, ctx) => [tb(str(node, "text", ctx))] },
  "sap.m.CheckBox": { terminal: "a toggle `[x] text`", note: "Space toggles and raises `select` (`${$parameters>/selected}`)", render: (node, ctx) => toggle(node, ctx, "selected", { variant: "check", label: str(node, "text", ctx), event: has(node, "select") ? "select" : undefined, param: "selected" }) },
  "sap.m.Switch": { terminal: "a toggle `[On ]` / `[Off]`", note: "Space toggles and raises `change` (`${$parameters>/state}`); `customTextOn`/`customTextOff` replace On/Off", render: (node, ctx) => toggle(node, ctx, "state", { variant: "switch", label: "", event: has(node, "change") ? "change" : undefined, param: "state", on: str(node, "customTextOn", ctx) || "On", off: str(node, "customTextOff", ctx) || "Off" }) },
  "sap.m.SegmentedButton": { terminal: "a pick list drawn expanded `[ (o) A  ( ) B ]`", note: "Left/Right picks and raises `selectionChange`", render: (node, ctx) => choice(node, ctx, { prop: "selectedKey", variant: "segmented", change: has(node, "selectionChange") ? "selectionChange" : undefined }) },
  "sap.m.SegmentedButtonItem": { terminal: "an option of its SegmentedButton", note: "", render: (node, ctx) => [tb(str(node, "text", ctx))] },
  "sap.m.Select": { terminal: "a pick list `[Berlin    v]`: Left/Right step through the options, Enter opens the list", note: "picking raises `change`", render: (node, ctx) => choice(node, ctx, { prop: "selectedKey", variant: "select", change: has(node, "change") ? "change" : undefined }) },
  "sap.m.DatePicker": {
    terminal: "an editable field holding the value as the model has it",
    note: "no calendar - the value is typed (in `valueFormat`, shown as placeholder); `change` raised on commit (`value`, `valid`)",
    render(node, ctx) {
      const w = field(node, ctx, "value", { kind: "input", value: text(attr(node, "value", ctx)), placeholder: str(node, "placeholder", ctx) || str(node, "valueFormat", ctx) || str(node, "displayFormat", ctx) || undefined, change: inputEvents(node, ctx, ["change"]), params: (v) => ({ value: v, valid: true }) });
      return [inline([{ widget: w }])];
    },
  },
  "sap.m.SearchField": {
    terminal: "an editable field; Enter raises `search`",
    note: "`search` gets `query`; `liveChange` raised on commit (`newValue`); `suggest` not raised",
    render(node, ctx) {
      const w = field(node, ctx, "value", {
        kind: "input", value: text(attr(node, "value", ctx)), placeholder: str(node, "placeholder", ctx) || "Search", change: inputEvents(node, ctx, ["liveChange"]),
        submit: has(node, "search") ? "search" : undefined, params: (v) => ({ query: v, newValue: v, refreshButtonPressed: false, clearButtonPressed: false }),
      });
      return [inline([{ widget: w }])];
    },
  },
  "sap.m.ComboBox": { terminal: "a pick list (as Select); an editable field when it has no items", note: "picking raises `change` (`value`)", render: (node, ctx) => choice(node, ctx, { prop: has(node, "selectedKey") ? "selectedKey" : "value", variant: "combo", change: has(node, "change") ? "change" : undefined, params: (v) => ({ value: v }) }) },
  "sap.m.MultiInput": {
    terminal: "the token texts, then an editable field",
    note: "tokens are shown, not edited as tokens - approximated (reported)",
    render(node, ctx) {
      const tokens = rowsOf(node, "tokens", ctx).map(({ base, node: t }) => str(t, "text", ctx.with(base)) || str(t, "key", ctx.with(base)));
      if (tokens.length) ctx.report(node, "tokens shown as text");
      const w = field(node, ctx, "value", { kind: "input", value: text(attr(node, "value", ctx)), change: inputEvents(node, ctx, ["change"]), params: (v) => ({ value: v }) });
      return [inline([...tokens.map((t) => ({ text: `{${t}}`, style: "cyan" })), { widget: w }])];
    },
  },
  "sap.m.Token": { terminal: "a text `{text}` of its MultiInput", note: "", render: (node, ctx) => [tb(`{${str(node, "text", ctx)}}`, "cyan")] },
  "sap.m.MultiComboBox": { terminal: "a pick list of several `[A, B    v]`: Enter opens the list, Space ticks, Enter confirms", note: "confirming raises `selectionChange` and `selectionFinish`", render: (node, ctx) => choice(node, ctx, { prop: "selectedKeys", variant: "select", multi: true, change: ["selectionChange", "selectionFinish"].filter((e) => has(node, e)) }) },
  "sap.m.StepInput": {
    terminal: "an editable number field; Up/Down step by `step` within `min`/`max`",
    note: "`change` raised on commit (`value`)",
    render(node, ctx) {
      const num = (p) => (has(node, p) ? Number(attr(node, p, ctx)) : undefined);
      const w = field(node, ctx, "value", { kind: "input", numeric: true, step: { step: num("step") || 1, min: num("min"), max: num("max") }, value: text(attr(node, "value", ctx)), change: inputEvents(node, ctx, ["change"]), params: (v) => ({ value: v }) });
      return [inline([{ widget: w }])];
    },
  },
  "sap.ui.core.ListItem": { terminal: "an option of its ComboBox/Select", note: "`additionalText` dropped", render: (node, ctx) => [tb(str(node, "text", ctx))] },
  "sap.m.DateTimePicker": { terminal: "an editable field (as DatePicker)", note: "no calendar; `change` raised on commit", render: (node, ctx) => CONTROLS["sap.m.DatePicker"].render(node, ctx) },

  // -------------------------------------------------------------- actions
  "sap.m.Button": {
    terminal: "a button `[ text ]`; Enter (or Space) presses it",
    note: "an icon-only button shows the icon's short text (`[ + ]`); `type` Emphasized -> bold, Accept -> green, Reject -> red; `enabled=false` or no press wire -> dim, not focusable",
    render: button,
  },
  "sap.m.ToggleButton": { terminal: "a toggle `[x] text`", note: "Space toggles `pressed` and raises `press` (`${$parameters>/pressed}`)", render: (node, ctx) => toggle(node, ctx, "pressed", { variant: "check", label: str(node, "text", ctx) || iconText(str(node, "icon", ctx)), event: has(node, "press") ? "press" : undefined, param: "pressed" }) },

  // ------------------------------------------------- collections & tables
  "sap.m.Column": { terminal: "a column of its Table; `header` -> the header line", note: "popin and widths ignored - the widths follow the content and the screen", render: () => [] },
  "sap.m.ColumnListItem": { terminal: "a row of its Table; `press` -> the row is an action (Enter); `selected` -> a leading `[x]` in a selectable table", note: "", render: (node, ctx) => row(aggregation(node, "cells"), ctx) },
  "sap.m.Table": {
    terminal: "a grid: header line, a rule, a line per row, the columns fitted to the width (cut with an ellipsis); the screen scrolls",
    note: "`itemPress` -> every row is an action (`>` marks the focused one); `mode` *Select + `selected` binding -> a `[x]` per row; growing ignored (every row is shown); `selectionChange` raised when a row is ticked",
    render: table,
  },
  "sap.m.List": { terminal: "a grid without header: title, description (dim), info (colored by `infoState`)", note: "`itemPress`/item `press` -> the row is an action; `mode` *Select + `selected` -> `[x]`; `delete` not raised", render: (node, ctx) => list(node, ctx) },
  "sap.m.StandardListItem": { terminal: "a row of its List", note: "`icon` -> its short text; `highlight` dropped", render: (node, ctx) => [tb(str(node, "title", ctx))] },
  "sap.m.CustomListItem": { terminal: "a row of its List with its content", note: "", render: stack },
  "sap.m.Tree": { terminal: "a List, the tree flattened depth first (two spaces per level)", note: "every node is shown expanded; `toggleOpenState` not raised", render: (node, ctx) => list(node, ctx, { tree: true }) },
  "sap.m.StandardTreeItem": { terminal: "a row of its Tree", note: "", render: (node, ctx) => [tb(str(node, "title", ctx))] },

  // ---------------------------------------------------- dialogs & popups
  "sap.m.Dialog": {
    terminal: "an overlay frame titled by `title` above the page, its buttons in the bottom line",
    note: "modal: only its widgets take the focus while it is open; Esc does not close it (the app decides); `afterClose` not raised",
    render: (node, ctx) => frame(node, ctx, { buttons: ["buttons", "beginButton", "endButton"] }),
  },
  "sap.m.Popover": {
    terminal: "an overlay frame (as Dialog)",
    note: "no anchor; not modal - the page stays focusable, Esc or an action of the page closes it (as UI5 does on a press outside); `afterClose` not raised",
    render: (node, ctx) => frame(node, ctx, { buttons: ["beginButton", "endButton"] }),
  },

  // ------------------------------------------------------------- messages
  "sap.m.MessageStrip": {
    terminal: "a banner `Error: text` colored by `type` (Error red, Warning yellow, Success green, Information blue)",
    note: "`showCloseButton`/`close` dropped; formatted text shown as text",
    render: (node, ctx) => [{ t: "banner", kind: ({ Error: "error", Warning: "warning", Success: "success" })[str(node, "type", ctx)] || "info", text: truthy(attr(node, "enableFormattedText", ctx)) ? clean(htmlToText(text(attr(node, "text", ctx)))) : para(node, "text", ctx) }],
  },

  // ----------------------------------------------------- tolerated (no UI)
  "sap.ui.core.CustomData": { terminal: "(nothing)", note: "tolerated, no UI", render: () => [] },
  "sap.m.FlexItemData": { terminal: "(nothing)", note: "tolerated, no UI", render: () => [] },
  "sap.ui.layout.GridData": { terminal: "(nothing)", note: "tolerated, no UI", render: () => [] },
  "sap.m.OverflowToolbarLayoutData": { terminal: "(nothing)", note: "tolerated, no UI", render: () => [] },
};

/** The content of a SimpleForm: a Label and the fields after it are one
 *  row; a Title is a section heading. */
function formRows(nodes, ctx) {
  const out = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    if (current.items.length) out.push({ t: "field", label: current.label, items: current.items });
    else out.push(tb(current.label, "bold"));
    out.push(...current.rest);
    current = null;
  };
  for (const n of nodes) {
    const name = controlName(n);
    if (name === "sap.m.Label") {
      flush();
      if (has(n, "visible") && falsy(attr(n, "visible", ctx))) continue;
      current = { label: str(n, "text", ctx), items: [], rest: [] };
      continue;
    }
    if (name === "sap.ui.core.Title") {
      flush();
      out.push(...renderNode(n, ctx));
      continue;
    }
    const blocks = renderNode(n, ctx);
    if (!current) {
      out.push(...blocks);
      continue;
    }
    const items = current.rest.length ? null : asInline(blocks);
    if (items) current.items.push(...items);
    else current.rest.push(...blocks);
  }
  flush();
  return out;
}

