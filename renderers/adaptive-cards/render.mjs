/*
 * abap2UI5 view -> Adaptive Card (schema 1.5). A pure function of the
 * folded response state (the vendored agent client's applyResponse: the views
 * in their slots, the models), no browser, no I/O:
 *
 *   renderCard(state, { messages, error, typed }) -> { card, unsupported }
 *
 * The view XML is parsed by the vendored mcp-server viewxml module (resolved
 * namespaces, bindings, event wires, expression bindings without eval); the
 * mapping of each portable control is the table in mapping.mjs, which also
 * generates the README.
 *
 * Inputs carry their binding path as id (`/NAME`, `/T_ITEMS/1/TEXT`), so an
 * Action.Submit payload names the model paths it changed (submit.mjs turns it
 * back into the next protocol request). A backend event becomes an
 * Action.Submit whose data is { event, args } - args resolved when the card
 * was rendered, `refs` naming the model path of an argument read from the
 * model, so the reverse step can read it again after the edits of the same
 * submit. A frontend-only wire (`.eF(...)`) becomes { client: [action,
 * args...] }, the reserved leave event { event: "___ZZZ_NAL" }.
 *
 * The live layers are interactive (liveSlots: a message box or a popup
 * alone - they are modal - else the popover and MAIN); the layers below a
 * modal one are rendered read-only (texts, no inputs, no actions). An action
 * of a popup or popover names its slot in its data (`slot`), so the reverse
 * step knows whose inputs and model it submits.
 */
import {
  LEAVE_EVENT, modelKeyOf, liveSlots, absolutePath, resolve, boundPath, text, truthy, falsy,
  children, aggregation, contentChildren, rowsOf, wireData, parseSlot, htmlToText, controlName, isAggregation,
} from "../common/view.mjs";
import { CONTROLS, TOLERATED } from "./mapping.mjs";

export const CARD_SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json";
export const CARD_VERSION = "1.5";

// the view helpers shared with the terminal renderer (../common/view.mjs)
export {
  LEAVE_EVENT, modelKeyOf, liveSlots, absolutePath, resolve, boundPath, text,
  children, aggregation, contentChildren, rowsOf, wireData, htmlToText,
};

/** An Action.Submit for an event wire (or a disabled one without a wire). */
export function submitAction(title, data, { style, enabled = true, tooltip } = {}) {
  const a = { type: "Action.Submit", title: title || "(action)" };
  if (style) a.style = style;
  if (tooltip) a.tooltip = tooltip;
  if (data) a.data = data;
  if (!data || !enabled) a.isEnabled = false;
  return a;
}

export const actionSet = (actions) => ({ type: "ActionSet", actions });

// ------------------------------------------------------------ render ----

/*
 * The render context: the model of the slot, the binding context of the
 * current row (`base`), whether the layer is interactive, and the sink for
 * what could not be rendered.
 */
function context({ model, slot, interactive, unsupported, ids }) {
  const ctx = {
    model: model || {},
    base: "",
    slot,
    interactive,
    ids,
    report(node, reason) {
      unsupported.push({ slot, control: controlName(node), ...(node.attrs.id ? { id: node.attrs.id } : {}), reason });
    },
    with(base) {
      return { ...ctx, base };
    },
  };
  return ctx;
}

/** One control -> card elements. */
export function renderNode(node, ctx) {
  if (isAggregation(node)) return renderList(node.children, ctx);
  if (node.attrs.visible !== undefined) {
    const v = resolve(node.attrs.visible, ctx);
    if (falsy(v)) return [];
  }
  const name = controlName(node);
  if (TOLERATED.has(name)) return [];
  const m = CONTROLS[name];
  if (!m) {
    ctx.report(node, "not in the portable profile - placeholder");
    return [{ type: "TextBlock", text: `[${name} - not rendered]`, isSubtle: true, wrap: true }];
  }
  return m.render(node, ctx) || [];
}

const INPUT_TYPES = new Set(["Input.Text", "Input.Number", "Input.Date", "Input.Time", "Input.Toggle", "Input.ChoiceSet"]);

/** A list of controls -> card elements: a Label names the input after it,
 *  neighbouring action sets merge into one. */
export function renderList(nodes, ctx) {
  const out = [];
  let label = null;
  for (const n of nodes) {
    if (isAggregation(n)) {
      out.push(...renderList(n.children, ctx));
      continue;
    }
    const name = controlName(n);
    if (name === "sap.m.Label" && ctx.interactive) {
      if (label) out.push(label.element);
      const visible = n.attrs.visible === undefined || !falsy(resolve(n.attrs.visible, ctx));
      label = visible ? { text: text(resolve(n.attrs.text, ctx)), element: CONTROLS["sap.m.Label"].render(n, ctx)[0] } : null;
      continue;
    }
    const els = renderNode(n, ctx);
    if (label) {
      const first = els[0];
      if (first && INPUT_TYPES.has(first.type) && !first.label && label.text) first.label = label.text;
      else out.push(label.element);
      label = null;
    }
    for (const e of els) {
      const prev = out[out.length - 1];
      if (e.type === "ActionSet" && prev && prev.type === "ActionSet") prev.actions.push(...e.actions);
      else out.push(e);
    }
  }
  if (label) out.push(label.element);
  return out;
}

/** A unique input id: the binding path, or the view id, or a counter. */
export function inputId(node, path, ctx) {
  let id = path || (node.attrs.id ? `${ctx.slot}:${node.attrs.id}` : `${ctx.slot}:input-${ctx.ids.size + 1}`);
  if (ctx.ids.has(id)) {
    let n = 2;
    while (ctx.ids.has(`${id}#${n}`)) n += 1;
    id = `${id}#${n}`;
  }
  ctx.ids.add(id);
  return id;
}

/** A read-only stand-in for an input in a layer that is not interactive. */
export function readOnly(labelText, value) {
  return { type: "TextBlock", text: labelText ? `${labelText}: ${text(value)}` : text(value), wrap: true };
}

// -------------------------------------------------------------- card ----

function renderSlot(state, slot, { interactive, unsupported, ids, typed }) {
  const s = state.slots[slot];
  const key = modelKeyOf(slot);
  const model = (state.models[key] && state.models[key].data) || {};
  const ctx = context({ model, slot, interactive, unsupported, ids });
  const items = renderList(parseSlot(s.xml), ctx);
  if (typed && interactive) applyTyped(items, typed);
  return items;
}

/** Values the user typed and did not submit yet, over the rendered ones. */
function applyTyped(items, typed) {
  walk(items, (e) => {
    if (e.id && INPUT_TYPES.has(e.type) && typed.has(e.id)) e.value = typed.get(e.id);
  });
}

/** Visit every element and action of a card body. */
export function walk(items, fn) {
  for (const e of items || []) {
    if (!e || typeof e !== "object") continue;
    fn(e);
    walk(e.items, fn);
    walk(e.actions, fn);
    if (e.inlineAction) walk([e.inlineAction], fn);
    if (e.selectAction) walk([e.selectAction], fn);
    for (const c of e.columns || []) walk(c.items, fn);
    for (const r of e.rows || []) for (const c of r.cells || []) { if (c.selectAction) walk([c.selectAction], fn); walk(c.items, fn); }
    if (e.card) walk(e.card.body, fn);
  }
}

const BOX_STYLE = { error: "attention", warning: "warning", success: "good", alert: "attention", information: "accent", show: "emphasis", confirm: "emphasis" };

function renderBox(box, interactive) {
  const items = [];
  if (box.title) items.push({ type: "TextBlock", text: box.title, weight: "Bolder", size: "Medium", wrap: true, style: "heading" });
  items.push({ type: "TextBlock", text: text(box.text), wrap: true });
  // details are shown with the box, expanded (spec/actions.md#messages)
  if (box.details) items.push({ type: "TextBlock", text: htmlToText(box.details), wrap: true, isSubtle: true });
  if (interactive) {
    const actions = (box.actions && box.actions.length ? box.actions : ["OK"]).map((a) => ({ type: "Action.Submit", title: String(a), data: { box: String(a) } }));
    items.push(actionSet(actions));
  }
  return { type: "Container", id: "message-box", style: BOX_STYLE[box.type] || "emphasis", items };
}

/**
 * The card for the folded state.
 *   messages  [{ kind: "toast"|"box", ... }] of the last response (host.mjs)
 *   error     { text } - the error the frontend shows, verbatim
 *   typed     Map<input id, value> the user typed and did not submit yet
 * Resolves { card, unsupported: [{ slot, control, id?, reason }] }.
 */
export function renderCard(state, { messages = [], error = null, typed = null } = {}) {
  const unsupported = [];
  const ids = new Set();
  const body = [];
  const slots = (state && state.slots) || {};
  const box = messages.find((m) => m.kind === "box");
  const live = liveSlots(state, messages);

  if (error) {
    // verbatim: a TextRun is not markdown, nothing in the body is markup
    body.push({ type: "Container", id: "error", style: "attention", items: [{ type: "RichTextBlock", inlines: [{ type: "TextRun", text: error.text }] }] });
  }
  for (const t of messages.filter((m) => m.kind === "toast")) body.push({ type: "TextBlock", text: t.text, isSubtle: true, wrap: true });
  if (box) body.push(renderBox(box, live.includes("BOX")));
  // MAIN is rendered first, so its inputs keep the plain binding paths as ids
  const rendered = {};
  for (const slot of ["MAIN", "POPUP", "POPOVER"]) {
    if (slots[slot]) rendered[slot] = renderSlot(state, slot, { interactive: live.includes(slot), unsupported, ids, typed });
  }
  for (const slot of ["POPUP", "POPOVER", "MAIN", "NEST", "NEST2"]) {
    if (!slots[slot]) continue;
    if (slot === "NEST" || slot === "NEST2") {
      // not in portable profile v1: processed, shown as a placeholder (profiles/portable.md section 2)
      unsupported.push({ slot, control: slot, reason: "nested view slot - not in portable profile v1, placeholder" });
      body.push({ type: "Container", id: `slot-${slot}`, items: [{ type: "TextBlock", text: `[${slot} view - not rendered]`, isSubtle: true, wrap: true }] });
      continue;
    }
    const items = rendered[slot];
    const c = { type: "Container", id: `slot-${slot}`, items: items.length ? items : [{ type: "TextBlock", text: " " }] };
    if (slot !== "MAIN") c.style = "emphasis";
    body.push(c);
  }
  const card = { type: "AdaptiveCard", $schema: CARD_SCHEMA, version: CARD_VERSION, body };
  return { card, unsupported };
}

/** The text a card shows (for tests and the conformance adapter). */
export function cardText(items) {
  const out = [];
  walk(Array.isArray(items) ? items : [items], (e) => {
    if (e.type === "TextBlock") out.push(e.text);
    else if (e.type === "RichTextBlock") out.push(...e.inlines.map((i) => (typeof i === "string" ? i : i.text)));
    else if (e.type === "FactSet") for (const f of e.facts) out.push(f.title, f.value);
    else if (e.type === "Input.Toggle") out.push(e.label, e.title);
    else if (e.type === "Input.ChoiceSet") {
      const chosen = String(e.value ?? "").split(",");
      out.push(e.label, ...e.choices.filter((c) => chosen.includes(c.value)).map((c) => c.title));
    } else if (e.type && e.type.startsWith("Input.")) out.push(e.label, e.value);
    else if (e.type && e.type.startsWith("Action.")) out.push(e.title);
  });
  return out.filter((x) => x !== undefined && x !== null && x !== "").map(String).join(" ");
}

export { truthy, falsy };
