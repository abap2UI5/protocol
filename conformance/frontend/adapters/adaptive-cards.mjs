/*
 * Adapter: the Adaptive Cards renderer prototype of this repository
 * (renderers/adaptive-cards/) - an in-process frontend of the portable
 * profile. Its host speaks the protocol over HTTP to the scripted backend;
 * every response is rendered into an Adaptive Card 1.5, and the suite looks
 * at that card:
 *
 *   state()      the card: a Container per slot (`slot-MAIN`, ...), its text,
 *                the values of its inputs (ids are binding paths)
 *   fill(t, v)   the user types into the card input whose id is t.path -
 *                held as a typed value, as a card host holds it, until a
 *                submit carries it
 *   press(t)     the user presses the Action.Submit raising t.event (or
 *                titled t.text): the host gets the action's data merged
 *                with the values of every input of the card - exactly what
 *                a card host submits - and builds the next request from it
 *   closeBox(a)  the message box button `a`
 *
 * What a card cannot do is not claimed: no URL, no DOM, no focus, no
 * document title, no programmatic model edit. It runs START_TIMER (the host
 * does) and queues a submit while a roundtrip is in flight.
 */
import { Unsupported, emptyState } from "./base.mjs";
import { createCardHost } from "../../../renderers/adaptive-cards/host.mjs";
import { walk, cardText, liveSlots, modelKeyOf, LEAVE_EVENT } from "../../../renderers/adaptive-cards/render.mjs";
import { coerce } from "../../../renderers/adaptive-cards/submit.mjs";
import { getAt } from "./vendor/mcp-server/snapshot.mjs";

const INPUT = /^Input\./;

export function createAdaptiveCardsAdapter() {
  let mock = null;
  let host = null;
  let typed = new Map();

  const render = () => host.render({ typed });

  /** The interactive layers of the card: the box, else the live slots. */
  function liveItems(card) {
    return liveSlots(host.state, host.messages)
      .map((s) => card.body.find((e) => e.id === (s === "BOX" ? "message-box" : `slot-${s}`)))
      .filter(Boolean);
  }

  function inputs(items) {
    const out = [];
    walk(items, (e) => {
      if (INPUT.test(e.type) && e.id) out.push(e);
    });
    return out;
  }

  function actions(items) {
    const out = [];
    walk(items, (e) => {
      if (e.type === "Action.Submit" && e.data) out.push(e);
    });
    return out;
  }

  /** What a card host submits for an action: its data and every input value. */
  function payloadFor(action) {
    const { card } = render();
    const values = {};
    for (const i of inputs(liveItems(card))) values[i.id] = i.value === undefined || i.value === null ? "" : String(i.value);
    typed = new Map();
    return { ...action.data, ...values };
  }

  function findAction(target) {
    const all = actions(liveItems(render().card)).filter((a) => a.isEnabled !== false);
    const event = target.nav ? LEAVE_EVENT : target.event;
    return (event && all.find((a) => a.data.event === event)) || (target.text && all.find((a) => a.title === target.text)) || null;
  }

  const adapter = {
    name: "adaptive-cards",
    description: "the Adaptive Cards renderer prototype (renderers/adaptive-cards/), in process",
    profiles: ["core", "portable"],
    capabilities: new Set(["concurrent", "boxClose", "timers"]),

    async open({ mock: m }) {
      mock = m;
      adapter.version = "renderers/adaptive-cards (this repository), Adaptive Cards 1.5";
    },

    async start(run, { app, search } = {}) {
      if (!app && search === undefined) throw new Unsupported("the card host starts apps by class name");
      typed = new Map();
      host = createCardHost({ url: run.url, location: (cls) => ({ origin: mock.origin, pathname: run.path, search: `?app_start=${encodeURIComponent(cls)}` }) });
      await host.start(app, search !== undefined ? { search } : {});
    },

    async fill(target, value) {
      if (!host) throw new Unsupported("no card");
      if (!target.path) throw new Unsupported("card inputs are addressed by binding path");
      const input = inputs(liveItems(render().card)).find((i) => i.id === target.path);
      if (!input) throw new Error(`no input "${target.path}" on the card (inputs: ${inputs(liveItems(render().card)).map((i) => i.id).join(", ") || "none"})`);
      typed.set(input.id, typeof value === "boolean" ? String(value) : value);
    },

    async press(target, { wait = true } = {}) {
      if (!host) throw new Unsupported("no card");
      const action = findAction(target);
      if (!action) throw new Error(`no action ${target.event || target.text} on the card`);
      // built when it leaves the host's queue - the card it reads is the one
      // on screen then
      const p = host.submit(() => payloadFor(action));
      if (wait) await p;
      else p.catch(() => {});
    },

    async closeBox({ action, text }) {
      const box = render().card.body.find((e) => e.id === "message-box");
      const a = box && actions([box]).find((x) => x.data.box === action || x.title === text);
      if (!a) throw new Unsupported("no message box with that action on the card");
      await host.submit(() => payloadFor(a));
    },

    async back() {
      throw new Unsupported("a card has no browser history");
    },

    async setModel() {
      throw new Unsupported("a card host has no programmatic model access");
    },

    async settle() {
      if (host) await host.settle();
    },

    async state() {
      const s = emptyState();
      if (!host) return s;
      const { card, unsupported } = render();
      const st = host.state;
      s.started = Boolean(st.id) || Boolean(host.error);
      s.app = st.app || null;
      s.id = st.id || null;
      s.card = card;
      for (const slot of Object.keys(s.slots)) {
        const c = card.body.find((e) => e.id === `slot-${slot}`);
        if (c) s.slots[slot] = { open: true, text: cardText(c) };
      }
      for (const slot of liveSlots(st, host.messages)) {
        const c = card.body.find((e) => e.id === `slot-${slot}`);
        const m = st.models[modelKeyOf(slot)];
        for (const i of inputs(c ? [c] : [])) {
          if (!i.id.startsWith("/") || Object.prototype.hasOwnProperty.call(s.values, i.id)) continue;
          s.values[i.id] = coerce(i.value === undefined ? "" : i.value, getAt((m && m.data) || {}, i.id));
        }
      }
      for (const [k, m] of Object.entries(st.models)) s.models[k] = m.data;
      s.messages = host.messages.map((m) => ({ kind: m.kind, text: m.text, ...(m.type ? { type: m.type } : {}) }));
      s.error = host.error;
      s.log = [...host.log, ...unsupported.map((u) => `unsupported: ${u.control}${u.id ? ` #${u.id}` : ""} (${u.slot}) - ${u.reason}`)];
      s.text = cardText(card.body);
      return s;
    },

    async stop() {
      if (host) {
        host.stop();
        await host.settle().catch(() => {});
      }
      host = null;
    },

    async close() {},
  };
  return adapter;
}
