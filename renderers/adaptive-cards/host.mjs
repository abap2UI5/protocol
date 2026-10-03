/*
 * A minimal Adaptive Cards host for an abap2UI5 backend: it speaks the
 * roundtrip protocol over HTTP, keeps the folded response state, renders it
 * as a card (render.mjs) and turns an Action.Submit payload into the next
 * request (submit.mjs). What a bot or a chat integration would wrap; the
 * conformance adapter (conformance/frontend/adapters/adaptive-cards.mjs)
 * drives it.
 *
 *   const host = createCardHost({ url: "https://host/sap/bc/z2ui5" });
 *   await host.start("Z2UI5_CL_APP");
 *   host.render().card                    // the Adaptive Card JSON
 *   await host.submit({ event: "SAVE", "/NAME": "Ada" })
 *
 * The client rules of spec/transport.md: Content-Type and
 * sap-contextid-accept on every POST, the last sap-contextid kept and sent
 * back, the CSRF token handshake (403 + X-CSRF-Token: Required), no retry of
 * a 500, one roundtrip at a time - a submit while one is in flight is queued
 * and built when it leaves (decided in revision 0.3, open question 8).
 * Follow-up actions: toasts and message boxes are shown, START_TIMER and a
 * toast's onClose fire their event, the other portable actions are no-ops a card has no
 * counterpart for (logged), an unknown or excluded action is skipped and
 * logged (profiles/portable.md#6-frontend-actions).
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { applyResponse, emptyState, getAt, setAt } from "../../conformance/frontend/adapters/vendor/mcp-server/snapshot.mjs";
import { renderCard, modelKeyOf, walk } from "./render.mjs";
import { submitToRequest, startRequest, eventRequest } from "./submit.mjs";

export const PROTOCOL = 2;

const PROFILE = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../profiles/portable-v1.json", import.meta.url)), "utf8"));
/** What a portable renderer receives as T_CUSTOM / .eF (portable-v1.json actions.wire). */
const WIRE = PROFILE.actions.wire;

const validContextId = (v) => typeof v === "string" && v.trim() !== "" && v !== "undefined" && v !== "null";

export function createCardHost({ url, location, fetchImpl = globalThis.fetch, timers = true, onChange = () => {} } = {}) {
  if (!url) throw new Error("createCardHost: url is required");
  const u = new URL(url);
  const where = location || ((app) => ({ origin: u.origin, pathname: u.pathname, search: `?app_start=${encodeURIComponent(app)}` }));

  let state = emptyState();
  let error = null;
  let messages = [];
  const log = [];
  /** per model key: path -> value, edited and not sent yet */
  const pending = { MAIN: new Map(), POPUP: new Map(), POPOVER: new Map() };
  let contextId = null;
  let csrf = null;
  let inflight = null;
  const queue = [];
  const armed = new Set();
  let stopped = false;

  const changed = () => onChange(host);

  async function post(body) {
    const text = JSON.stringify({ value: body });
    const send = () => {
      const headers = { "content-type": "application/json", "sap-contextid-accept": "header" };
      if (contextId) headers["sap-contextid"] = contextId;
      if (csrf) headers["x-csrf-token"] = csrf;
      return fetchImpl(url, { method: "POST", headers, body: text });
    };
    let res = await send();
    if (res.status === 403 && /^required$/i.test(res.headers.get("x-csrf-token") || "")) {
      await res.text();
      const head = await fetchImpl(url, { method: "HEAD", headers: { "x-csrf-token": "Fetch" } });
      csrf = head.headers.get("x-csrf-token") || null;
      if (csrf) res = await send();
    }
    const id = res.headers.get("sap-contextid");
    if (validContextId(id)) contextId = id;
    return { status: res.status, type: res.headers.get("content-type") || "", text: await res.text() };
  }

  /** One response read and, when it is a valid one, adopted. */
  function adopt(r) {
    if (r.status < 200 || r.status >= 300) {
      // the body is shown verbatim - it is text/plain, never markup (spec/errors.md)
      error = { text: r.text ? `HTTP ${r.status}\n${r.text}` : `HTTP ${r.status}` };
      return;
    }
    let json;
    try {
      json = JSON.parse(r.text);
    } catch {
      error = { text: `the backend answered no JSON (${r.type || "no content type"}): ${r.text.slice(0, 200)}` };
      return;
    }
    if (!json || typeof json !== "object" || !json.S_FRONT) {
      error = { text: `the backend answered without S_FRONT: ${r.text.slice(0, 200)}` };
      return;
    }
    const p = json.S_FRONT.PROTOCOL;
    if (p !== undefined && p !== PROTOCOL) {
      error = { text: `the backend speaks protocol ${p}, this renderer protocol ${PROTOCOL} - nothing adopted` };
      return;
    }
    error = null;
    // a response of another app takes popup and popover down (spec/response.md#view-slots)
    if (json.S_FRONT.APP && state.app && json.S_FRONT.APP !== state.app) {
      state = { ...state, slots: { ...state.slots }, models: { ...state.models } };
      for (const s of ["POPUP", "POPOVER"]) {
        delete state.slots[s];
        delete state.models[s];
        pending[s].clear();
      }
    }
    state = applyResponse(state, json);
    // edits not sent yet survive a model push
    for (const [key, map] of Object.entries(pending)) {
      const m = state.models[key];
      if (!m) {
        map.clear();
        continue;
      }
      for (const [path, v] of map) setAt(m.data, path, v);
    }
    messages = messages.filter((m) => m.kind === "box");
    for (const a of state.custom) followUp(a);
  }

  function followUp(raw) {
    const a = raw[0] === "CONTROL_GLOBAL" ? raw.slice(1) : raw;
    const [name, method, ...rest] = a;
    if (name === "MESSAGE_TOAST" && method === "show") {
      messages.push({ kind: "toast", text: String(rest[0] ?? "") });
      // a toast with onClose raises it when it closes ([CC] showToast) - after its duration
      const o = (rest[1] && typeof rest[1] === "object") ? rest[1] : {};
      if (o.onClose && timers) later(String(o.onClose), Number(o.duration) || 3000);
      return;
    }
    if (name === "MESSAGE_BOX") {
      const o = (rest[1] && typeof rest[1] === "object") ? rest[1] : {};
      messages = messages.filter((m) => m.kind !== "box");
      messages.push({ kind: "box", type: method === "show" ? undefined : method, text: String(rest[0] ?? ""), title: o.title, details: o.details, actions: o.actions, onClose: o.onClose });
      return;
    }
    if (name === "START_TIMER") {
      if (!timers) {
        log.push(`noop: START_TIMER ${method} (timers off)`);
        return;
      }
      later(String(method), Number(rest[0]) || 0);
      return;
    }
    if (WIRE.custom.includes(name) || (WIRE.customGlobals[name] || []).includes(method)) {
      log.push(`noop: ${name}${raw[0] === "CONTROL_GLOBAL" ? ` ${method}` : ""} - no counterpart in a card`);
      return;
    }
    const excluded = PROFILE.frontendActions.excluded.some((x) => x === name || x === `${raw[0]} ${name}`);
    log.push(`${excluded ? "outside the portable profile" : "unknown follow-up action"}: ${raw[0] === "CONTROL_GLOBAL" ? `CONTROL_GLOBAL ${name}` : name} - skipped`);
  }

  /** An event raised by the frontend itself after `ms` (a timer, a toast
   *  closing) - an ordinary roundtrip, queued like any other. */
  function later(event, ms) {
    const t = setTimeout(() => {
      armed.delete(t);
      if (!stopped) host.submit({ event }, { timer: true }).catch(() => {});
    }, ms);
    armed.add(t);
  }

  /** A frontend-only wire (.eF): no roundtrip. */
  function client(action) {
    const a = action[0] === "CONTROL_GLOBAL" ? action.slice(1) : action;
    if (a[0] === "VIEW_SLOTS" && a[1] === "destroy") {
      state = applyResponse(state, { S_FRONT: { S_ACTION: { T_CUSTOM: [["VIEW_SLOTS", "destroy", a[2]]] } } });
      if (pending[a[2]]) pending[a[2]].clear();
      return;
    }
    followUp(action);
  }

  function keepEdits(slot, model, edits) {
    const key = modelKeyOf(slot);
    if (!state.models[key]) return;
    state.models[key].data = model;
    for (const p of edits) pending[key].set(p, getAt(model, p));
  }

  async function roundtrip(body) {
    let r;
    try {
      r = await post(body);
    } catch (e) {
      error = { text: `the backend did not answer: ${(e && e.message) || e}` };
      return;
    }
    adopt(r);
  }

  /** Run one queued job; the payload is built when it leaves. */
  async function run(job) {
    if (job.start) {
      await roundtrip(job.start);
      return;
    }
    const payload = typeof job.payload === "function" ? job.payload() : job.payload;
    if (!payload) return;
    if (!job.timer && payload.event && !hasEvent(payload.event)) {
      log.push(`queued action ${payload.event} dropped - no longer on the card`);
      return;
    }
    const slot = payload.slot || "MAIN";
    const key = modelKeyOf(slot);
    const r = submitToRequest(state, payload, { pending: [...pending[key].keys()], ids: slotInputs(slot) });
    // a press outside an open popover closes it first, as UI5 does
    if (slot === "MAIN" && state.slots.POPOVER && r.kind !== "box") client(["VIEW_SLOTS", "destroy", "POPOVER"]);
    if (r.kind === "client") {
      keepEdits(r.slot, r.model, r.edits);
      client(r.action);
      return;
    }
    if (r.kind === "box") {
      keepEdits(r.slot, r.model, r.edits);
      const box = messages.find((m) => m.kind === "box");
      messages = messages.filter((m) => m.kind !== "box");
      if (box && box.onClose) await roundtrip(eventRequest(state, String(box.onClose), [r.action], buildPending(key)));
      return;
    }
    // what is sent is no longer pending; what is typed meanwhile is
    if (state.models[key]) state.models[key].data = r.model;
    pending[key].clear();
    await roundtrip(r.request);
  }

  function buildPending(key) {
    // a box close carries the edits made so far, like any event from that slot
    const m = state.models[key];
    if (!m || !pending[key].size) return {};
    const req = submitToRequest(state, { event: "_", ...(key !== "MAIN" ? { slot: key } : {}) }, { pending: [...pending[key].keys()], ids: [] });
    pending[key].clear();
    return req.request.MODEL || {};
  }

  /** The input ids the card shows in `slot`. */
  function slotInputs(slot) {
    const c = host.render().card.body.find((e) => e.id === `slot-${slot}`);
    const ids = [];
    walk(c ? [c] : [], (e) => {
      if (/^Input\./.test(e.type) && e.id) ids.push(e.id);
    });
    return ids;
  }

  function hasEvent(event) {
    let found = false;
    walk(host.render().card.body, (e) => {
      if (e.data && e.data.event === event) found = true;
    });
    return found;
  }

  function enqueue(job) {
    return new Promise((resolve, reject) => {
      queue.push({ ...job, resolve, reject });
      pump();
    });
  }

  async function pump() {
    if (inflight || !queue.length) return;
    const job = queue.shift();
    inflight = (async () => {
      try {
        await run(job);
        job.resolve(host);
      } catch (e) {
        job.reject(e);
      } finally {
        inflight = null;
        changed();
        pump();
      }
    })();
  }

  const host = {
    get state() { return state; },
    get error() { return error; },
    get messages() { return messages.slice(); },
    get log() { return log.slice(); },
    get busy() { return Boolean(inflight) || queue.length > 0; },
    get contextId() { return contextId; },

    /** Start an app: the app-start request (no ID, ?app_start=<CLASS>). */
    start(app, { search } = {}) {
      const loc = where(app);
      return enqueue({ start: startRequest({ ...loc, ...(search !== undefined ? { search } : {}) }) });
    },

    /** The card for the current state. `typed`: input values the user typed
     *  and did not submit yet (Map id -> value). */
    render({ typed } = {}) {
      return renderCard(state, { messages, error, typed });
    },

    /** An Action.Submit payload - or a function building it when it leaves
     *  the queue. Resolves when its roundtrip (if any) is adopted. */
    submit(payload, { timer = false } = {}) {
      return enqueue({ payload, timer });
    },

    /** Resolves once nothing is in flight or queued. */
    async settle() {
      while (inflight || queue.length) await (inflight || Promise.resolve());
    },

    /** Stop the timers; later timer events are dropped. */
    stop() {
      stopped = true;
      for (const t of armed) clearTimeout(t);
      armed.clear();
    },
  };
  return host;
}
