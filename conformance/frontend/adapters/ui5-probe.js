/*
 * Injected into the page of the UI5 adapter (Playwright addInitScript)
 * before anything else runs. It reads the frontend's state - never writes
 * it - and finds the controls an interaction targets; the interaction
 * itself is a real one (Playwright types and clicks in the DOM).
 *
 * window.__conf:
 *   idle()            the frontend has no roundtrip in flight and processed
 *                     the last response (follow-up actions included)
 *   locate(spec)      the DOM id to type into / click for a target:
 *                     { slot, id } | { slot, path } | { slot, text } | { slot, nav: true }
 *                     | { box: <button text> }
 *   state()           the normalized state the suite reads
 */
(() => {
  "use strict";
  const messages = () => window.__confMessages || [];
  const SLOT_KEYS = ["MAIN", "NEST", "NEST2", "POPUP", "POPOVER"];
  const req = (name) => (window.sap && sap.ui && sap.ui.require ? sap.ui.require(name) : undefined);

  function component() {
    const Component = req("sap/ui/core/Component");
    if (!Component) return null;
    const c = Component.getComponentById ? Component.getComponentById("container-z2ui5") : Component.get("container-z2ui5");
    return c && c.ctx ? c : null;
  }
  const ctxOf = () => (component() || {}).ctx;

  function allElements() {
    const Element = req("sap/ui/core/Element");
    if (Element && Element.registry) return Element.registry.all ? Object.values(Element.registry.all()) : Element.registry.filter(() => true);
    return [];
  }

  function slotOf(ctx, el) {
    const ViewSlots = req("z2ui5/core/ViewSlots");
    return ViewSlots ? ViewSlots.containingSlotKey(ctx, el) : undefined;
  }

  function visible(el) {
    const d = el.getDomRef && el.getDomRef();
    return Boolean(d && d.isConnected && (d.offsetWidth || d.offsetHeight || d.getClientRects().length));
  }

  const VALUE_PROPS = ["value", "selected", "state", "pressed", "selectedKey"];
  function boundPath(el, prop) {
    const b = el.getBinding && el.getBinding(prop);
    if (!b || !b.getPath) return null;
    const p = b.getPath();
    if (p.startsWith("/")) return p;
    const c = b.getContext && b.getContext();
    return c ? `${c.getPath()}/${p}` : null;
  }

  function localId(el) {
    const id = el.getId();
    const at = id.lastIndexOf("--");
    return at >= 0 ? id.slice(at + 2) : id;
  }

  function find(spec) {
    const ctx = ctxOf();
    if (!ctx) return { error: "the frontend has not started" };
    if (spec.box !== undefined) {
      const hits = allElements().filter((el) => el.getMetadata().getName() === "sap.m.Button" && visible(el)
        && el.getText && el.getText() === spec.box && el.getParent && el.getParent() && el.getParent().hasStyleClass && el.getParent().hasStyleClass("sapMMessageBox"));
      return hits.length ? { el: hits[0], kind: "button" } : { error: `no message box button "${spec.box}"` };
    }
    const slot = spec.slot || "MAIN";
    const inSlot = allElements().filter((el) => slotOf(ctx, el) === slot);
    if (spec.nav) {
      const p = inSlot.find((el) => el.getMetadata().getName() === "sap.m.Page" && el.getShowNavButton && el.getShowNavButton());
      if (!p) return { error: `no page with a nav button in ${slot}` };
      const btn = p.getAggregation("_navBtn");
      return btn ? { el: btn, kind: "button" } : { domId: `${p.getId()}-navButton`, kind: "button" };
    }
    let hits = [];
    if (spec.id) hits = inSlot.filter((el) => localId(el) === spec.id);
    else if (spec.path) hits = inSlot.filter((el) => VALUE_PROPS.some((p) => boundPath(el, p) === spec.path));
    else if (spec.text) hits = inSlot.filter((el) => el.getText && el.getMetadata().hasProperty("text") && el.getText() === spec.text && (el.getMetadata().getEvent("press") || el.getMetadata().getEvent("navButtonPress")));
    hits = hits.filter(visible);
    if (!hits.length) return { error: `no visible control for ${JSON.stringify(spec)} in slot ${slot}` };
    return { el: hits[0] };
  }

  function locate(spec) {
    const hit = find(spec);
    if (hit.error) return { error: hit.error };
    if (hit.domId) return { domId: hit.domId, kind: hit.kind };
    const el = hit.el;
    const name = el.getMetadata().getName();
    const focus = el.getFocusDomRef ? el.getFocusDomRef() : null;
    const dom = el.getDomRef();
    let kind = "click";
    if (/sap\.m\.(CheckBox|Switch|ToggleButton|RadioButton)$/.test(name)) kind = "toggle";
    else if (focus && (focus.tagName === "INPUT" || focus.tagName === "TEXTAREA")) kind = "text";
    const target = kind === "text" ? focus : dom;
    if (!target.id) target.id = `__conf_${Math.random().toString(36).slice(2)}`;
    let current;
    if (kind === "toggle") current = el.getSelected ? el.getSelected() : (el.getState ? el.getState() : el.getPressed && el.getPressed());
    return { domId: target.id, kind, control: name, current };
  }

  function texts(dom) {
    return dom ? dom.innerText.replace(/\s+/g, " ").trim() : "";
  }

  function slotState(ctx, key) {
    const ViewSlots = req("z2ui5/core/ViewSlots");
    const v = ViewSlots && ViewSlots.getView(ctx, key);
    if (!v || v.bIsDestroyed || (v.isDestroyed && v.isDestroyed())) return { open: false, text: "" };
    let open = true;
    if (typeof v.isOpen === "function") open = v.isOpen();
    const dom = v.getDomRef && v.getDomRef();
    return { open: open && Boolean(dom), text: texts(dom), viewId: v.getId() };
  }

  function modelOf(ctx, key) {
    const ViewSlots = req("z2ui5/core/ViewSlots");
    const v = ViewSlots && ViewSlots.getView(ctx, key);
    if (!v || v.bIsDestroyed) return undefined;
    const m = v.getModel && v.getModel();
    const d = m && m.getData ? m.getData() : undefined;
    return d === undefined ? undefined : JSON.parse(JSON.stringify(d));
  }

  function values(ctx) {
    const out = {};
    for (const el of allElements()) {
      const slot = slotOf(ctx, el);
      if (!slot) continue;
      for (const p of VALUE_PROPS) {
        const path = boundPath(el, p);
        if (path && !(path in out)) out[path] = el.getProperty(p);
      }
    }
    return out;
  }

  function focusId() {
    const Element = req("sap/ui/core/Element");
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const el = Element && Element.closestTo ? Element.closestTo(a) : null;
    return el ? localId(el) : a.id || null;
  }

  function state() {
    const ctx = ctxOf();
    const Lib = req("z2ui5/core/Lib");
    const out = {
      started: Boolean(ctx),
      app: null,
      id: null,
      slots: {},
      models: {},
      values: {},
      messages: messages().slice(),
      error: null,
      log: Lib && Lib.errors ? Lib.errors.map((e) => String(e.message)) : [],
      hash: window.location.hash,
      title: document.title,
      focus: focusId(),
      text: texts(document.body),
      xss: Boolean(window.__confXss),
    };
    if (!ctx) return out;
    const st = ctx.state;
    out.app = st.renderedApp || null;
    out.id = (st.oResponse && st.oResponse.ID) || null;
    for (const k of SLOT_KEYS) out.slots[k] = slotState(ctx, k);
    for (const k of ["MAIN", "POPUP", "POPOVER"]) out.models[k] = modelOf(ctx, k);
    out.values = values(ctx);
    if (st.lastError) out.error = { title: String(st.lastError.title || ""), text: String(st.lastError.text || "") };
    // toasts and boxes in the DOM, in case one was shown before the hook
    for (const d of document.querySelectorAll(".sapMMessageToast")) {
      const t = texts(d);
      if (t && !out.messages.some((m) => m.kind === "toast" && m.text === t)) out.messages.push({ kind: "toast", text: t });
    }
    return out;
  }

  function idle() {
    const ctx = ctxOf();
    if (!ctx) return false;
    if (window.__confProcessing) return false;
    const st = ctx.state;
    if (st.isBusy) return false;
    if (ctx.server && ctx.server.inflight && ctx.server.inflight.size) return false;
    if (st.oResponse && (!st.oResponse._processed || st.oResponse._pendingCustomJs)) return false;
    return true;
  }

  window.__conf = { idle, locate, state };
})();
