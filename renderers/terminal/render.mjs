/*
 * abap2UI5 view -> terminal screen document. A pure function of the folded
 * response state (the vendored snapshot module's applyResponse: the views in
 * their slots, the models) and what the session shows besides (messages, the
 * error), no I/O:
 *
 *   renderScreen(state, { messages, error }) ->
 *     { layers, widgets, unsupported, title }
 *
 * A layer is one slot (MAIN, POPUP, POPOVER) or the message box, as a list
 * of blocks (layout.mjs draws them at a width); `widgets` are the focusable
 * widgets of the live layers in focus order (overlays first). The mapping of
 * each portable control is the table in mapping.mjs, which also generates
 * the README.
 *
 * The view helpers (bindings, aggregations, list bindings, event wires) are
 * the ones the Adaptive Cards renderer uses (../common/view.mjs). A widget
 * keeps its node and binding context: the event data of a press or a change
 * is built when it fires, against the model as it is then (the edits of the
 * same keystroke included).
 *
 * Live layers: a message box or a popup alone (modal), else the popover and
 * MAIN (liveSlots). The layers below a modal one are drawn but not
 * focusable.
 */
import {
  liveSlots, modelKeyOf, resolve, falsy, parseSlot, htmlToText, controlName, isAggregation, wireData, TOLERATED,
} from "../common/view.mjs";
import { CONTROLS } from "./mapping.mjs";
import { clean } from "./text.mjs";

/**
 * The render context of one slot: its model, the binding context of the
 * current row (`base`), whether the layer is live, the widget registry and
 * the sink for what could not be rendered.
 */
function context({ model, slot, interactive, unsupported, widgets }) {
  const keys = new Map();
  const ctx = {
    model: model || {},
    base: "",
    slot,
    interactive,
    report(node, reason) {
      unsupported.push({ slot, control: controlName(node), ...(node.attrs.id ? { id: node.attrs.id } : {}), reason });
    },
    with(base) {
      return { ...ctx, base };
    },
    /*
     * A widget: { kind, label, value, path, node, ... } - registered as
     * focusable when the layer is live and the widget enabled. Its key is
     * stable over re-renders (slot, row, binding path or view id or label,
     * an ordinal for repeats), so the focus stays where it was.
     */
    widget(spec) {
      const node = spec.node;
      const base = this.base;
      const id = spec.path || (node && node.attrs.id) || spec.label || spec.kind;
      let key = `${slot}|${spec.kind}|${spec.path ? "" : base}|${id}`;
      const n = (keys.get(key) || 0) + 1;
      keys.set(key, n);
      if (n > 1) key += `#${n}`;
      const w = {
        enabled: true,
        ...spec,
        key,
        slot,
        base,
        viewId: node && node.attrs.id ? node.attrs.id : undefined,
        modelKey: modelKeyOf(slot),
        focusable: false,
      };
      const self = this;
      /** The data of event `name` of the widget's control, built now. */
      w.eventData = (name, params, target = node) => (target && target.attrs[name] !== undefined ? wireData(target, name, self, params) : null);
      if (interactive && w.enabled && spec.focusable !== false) {
        w.focusable = true;
        widgets.push(w);
      }
      return w;
    },
  };
  return ctx;
}

/** One control -> blocks. */
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
    return [{ t: "text", text: `[? ${name} - not rendered]`, style: "dim" }];
  }
  return m.render(node, ctx) || [];
}

/** A block list as inline items, or null when it does not fit on a line
 *  (a text with a line feed, a table, a box, ...). */
export function asInline(blocks) {
  const items = [];
  for (const b of blocks) {
    if (b.t === "inline") items.push(...b.items);
    else if (b.t === "text" && !String(b.text).includes("\n")) items.push({ text: b.text, style: b.style });
    else return null;
  }
  return items;
}

const FIELD_CONTROLS = new Set(["sap.m.Input", "sap.m.TextArea", "sap.m.CheckBox", "sap.m.Switch", "sap.m.SegmentedButton", "sap.m.Select",
  "sap.m.DatePicker", "sap.m.SearchField", "sap.m.ComboBox", "sap.m.MultiInput", "sap.m.MultiComboBox", "sap.m.StepInput",
  "sap.m.DateTimePicker", "sap.m.Text", "sap.m.ObjectStatus", "sap.m.ObjectNumber", "sap.m.Link", "sap.m.ToggleButton", "sap.m.HBox",
  "sap.m.FlexBox", "sap.tnt.InfoLabel", "sap.m.ProgressIndicator"]);

/** A list of controls -> blocks: a Label and the field after it become one
 *  label-field row (the labels of neighbouring rows align). */
export function renderList(nodes, ctx) {
  const out = [];
  let label = null;
  const flushLabel = () => {
    if (label) out.push({ t: "text", text: label.text, style: "bold" });
    label = null;
  };
  for (const n of nodes) {
    if (isAggregation(n)) {
      flushLabel();
      out.push(...renderList(n.children, ctx));
      continue;
    }
    const name = controlName(n);
    if (name === "sap.m.Label") {
      flushLabel();
      const visible = n.attrs.visible === undefined || !falsy(resolve(n.attrs.visible, ctx));
      if (visible) label = { text: clean(resolve(n.attrs.text, ctx) ?? "", { keepNewlines: false }) };
      continue;
    }
    const blocks = renderNode(n, ctx);
    if (label) {
      const items = FIELD_CONTROLS.has(name) ? asInline(blocks) : null;
      if (items && items.length) {
        out.push({ t: "field", label: label.text, items });
        label = null;
        continue;
      }
      flushLabel();
    }
    for (const b of blocks) {
      const prev = out[out.length - 1];
      if (b.merge && prev && prev.merge) out[out.length - 1] = { ...prev, items: [...prev.items, ...b.items] };
      else out.push(b);
    }
  }
  flushLabel();
  return out;
}

// ------------------------------------------------------------ screen ----

const BOX_TITLE = { error: "Error", warning: "Warning", success: "Success", alert: "Alert", information: "Information", confirm: "Confirm", show: "Message" };
const BOX_KIND = { error: "error", warning: "warning", success: "success", alert: "error", information: "info", confirm: "info" };

function renderBox(box, { interactive, widgets, unsupported }) {
  const ctx = context({ model: {}, slot: "BOX", interactive, unsupported, widgets });
  const blocks = [{ t: "text", text: clean(box.text) }];
  // details are shown with the box, expanded, as text (spec/actions.md#messages)
  if (box.details) blocks.push({ t: "blank" }, { t: "text", text: clean(htmlToText(box.details)), style: "dim" });
  const actions = (box.actions && box.actions.length ? box.actions : ["OK"]).map(String);
  const items = actions.map((a) => ({ widget: ctx.widget({ kind: "button", label: a, box: a }) }));
  blocks.push({ t: "blank" }, { t: "inline", items: [{ spacer: true }, ...items] });
  return { slot: "BOX", title: clean(box.title || BOX_TITLE[box.type] || "Message", { keepNewlines: false }), kind: BOX_KIND[box.type] || "info", blocks, interactive };
}

function renderSlot(state, slot, { interactive, unsupported, widgets }) {
  const key = modelKeyOf(slot);
  const model = (state.models[key] && state.models[key].data) || {};
  const ctx = context({ model, slot, interactive, unsupported, widgets });
  return renderList(parseSlot(state.slots[slot].xml), ctx);
}

/** The first page or dialog title of a layer's blocks. */
function titleOf(blocks) {
  for (const b of blocks) {
    if (b.t === "page" || b.t === "box") return b.title || null;
  }
  return null;
}

/**
 * The screen for the folded state.
 *   messages  [{ kind: "toast"|"box", ... }] the session shows
 *   error     { text } - the error the frontend shows, verbatim
 * Resolves { layers: [{ slot, blocks, interactive, title?, kind? }],
 *            widgets, unsupported: [{ slot, control, id?, reason }], title }.
 * Layers are in drawing order: MAIN (with NEST placeholders) first, then the
 * popup, the popover and the message box above it.
 */
export function renderScreen(state, { messages = [], error = null } = {}) {
  const unsupported = [];
  const slots = (state && state.slots) || {};
  const live = liveSlots(state, messages);
  const box = messages.find((m) => m.kind === "box");
  // focus order: the box, the popup, the popover, MAIN
  const order = { BOX: 0, POPUP: 1, POPOVER: 2, MAIN: 3 };
  const lists = { BOX: [], POPUP: [], POPOVER: [], MAIN: [] };
  const layers = [];
  const banners = [];
  if (error) banners.push({ t: "banner", kind: "error", text: clean(error.text) });
  for (const t of messages.filter((m) => m.kind === "toast")) banners.push({ t: "banner", kind: "toast", text: clean(t.text) });

  if (slots.MAIN) {
    const blocks = renderSlot(state, "MAIN", { interactive: live.includes("MAIN"), unsupported, widgets: lists.MAIN });
    for (const nest of ["NEST", "NEST2"]) {
      if (!slots[nest]) continue;
      // not in portable profile v1: processed, shown as a placeholder (profiles/portable.md section 2)
      unsupported.push({ slot: nest, control: nest, reason: "nested view slot - not in portable profile v1, placeholder" });
      blocks.push({ t: "text", text: `[? ${nest} view - not rendered]`, style: "dim" });
    }
    layers.push({ slot: "MAIN", blocks: [...banners, ...blocks], interactive: live.includes("MAIN"), title: titleOf(blocks) });
  } else if (banners.length) {
    layers.push({ slot: "MAIN", blocks: banners, interactive: false, title: null });
  }
  for (const slot of ["POPUP", "POPOVER"]) {
    if (!slots[slot]) continue;
    const blocks = renderSlot(state, slot, { interactive: live.includes(slot), unsupported, widgets: lists[slot] });
    // a Dialog or Popover is the overlay's frame; anything else gets one
    const framed = blocks.length === 1 && blocks[0].t === "box" ? blocks[0] : { t: "box", title: null, blocks };
    layers.push({ slot, blocks: framed.blocks, title: framed.title, interactive: live.includes(slot), kind: "overlay" });
  }
  if (box) layers.push({ ...renderBox(box, { interactive: live.includes("BOX"), widgets: lists.BOX, unsupported }), kind: "overlay" });
  const widgets = Object.keys(lists).sort((a, b) => order[a] - order[b]).flatMap((k) => lists[k]);
  const main = layers.find((l) => l.slot === "MAIN");
  return { layers, widgets, unsupported, title: main ? main.title : null };
}
