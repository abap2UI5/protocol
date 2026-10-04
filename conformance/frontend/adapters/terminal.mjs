/*
 * Adapter: the terminal renderer of this repository (renderers/terminal/) -
 * an in-process frontend of the portable profile, driven through its state
 * machine (app.mjs) the way a user drives it, with keys, and read from its
 * screen as text. No TTY is needed.
 *
 *   fill(t, v)   the user Tabs to the field bound to t.path (in t.slot when
 *                given) and types the value: Ctrl+U clears it, the
 *                characters go in one by one, Tab commits the edit (and
 *                moves on); a check box or switch is toggled with Space
 *                when its value differs, a pick list stepped with Right
 *                until it shows the value
 *   press(t)     the user Tabs to the action raising t.event (or labelled
 *                t.text) and presses Enter; t.nav is the page's back button
 *   closeBox(a)  the message box button `a`, the same way
 *   back()       Alt+Left - the renderer's hash history
 *   state()      the screen: a layer per slot and its text, the values of
 *                the bound fields, the hash, the title set by SET_TITLE,
 *                the view id of the focused widget
 *
 * What a terminal cannot do is not claimed: no DOM, no programmatic model
 * edit (only what a user types).
 */
import { Unsupported, emptyState } from "./base.mjs";
import { createSession } from "../../../renderers/terminal/session.mjs";
import { createTerminalApp } from "../../../renderers/terminal/app.mjs";
import { LEAVE_EVENT } from "../../../renderers/common/view.mjs";
import { coerce } from "../../../renderers/common/request.mjs";
import { getAt } from "./vendor/mcp-server/snapshot.mjs";

const WIDTH = 100;

export function createTerminalAdapter() {
  let mock = null;
  let session = null;
  let app = null;

  /** Tab until `match` has the focus - at most once round the widgets. */
  async function tabTo(match, what) {
    const ws = app.widgets();
    for (let i = 0; i <= ws.length; i += 1) {
      const f = app.focused();
      if (f && match(f)) return f;
      await app.key("tab");
    }
    const names = app.widgets().map((w) => w.path || w.label).join(", ");
    throw new Error(`no ${what} reachable with Tab (widgets: ${names || "none"})`);
  }

  /** The action data a widget would fire, for matching by event name. */
  function eventOf(w) {
    if (w.box !== undefined) return null;
    if (!w.press) return null;
    const d = w.eventData(w.press.name, undefined, w.press.target || w.node);
    return d && d.event;
  }

  const adapter = {
    name: "terminal",
    description: "the terminal renderer of this repository (renderers/terminal/), in process",
    profiles: ["core", "portable"],
    capabilities: new Set(["concurrent", "boxClose", "timers", "url", "title", "focus"]),

    async open({ mock: m }) {
      mock = m;
      adapter.version = "renderers/terminal (this repository)";
    },

    async start(run, { app: cls, search } = {}) {
      if (!cls && search === undefined) throw new Unsupported("the terminal starts apps by class name");
      session = createSession({ url: run.url, location: (c) => ({ origin: mock.origin, pathname: run.path, search: `?app_start=${encodeURIComponent(c)}` }) });
      app = createTerminalApp({ session, width: WIDTH, height: 40 });
      await session.start(cls, search !== undefined ? { search } : {});
    },

    async fill(target, value) {
      if (!app) throw new Unsupported("no screen");
      if (!target.path) throw new Unsupported("the terminal adapter finds fields by binding path");
      const w = await tabTo((f) => f.path === target.path && (!target.slot || f.slot === target.slot), `field ${target.path}`);
      if (w.kind === "toggle") {
        if (Boolean(w.value) !== (value === true || value === "true")) await app.key("space");
        return;
      }
      if (w.kind === "choice") {
        for (let i = 0; i <= w.options.length && String(app.focused().value) !== String(value); i += 1) await app.key("right");
        if (String(app.focused().value) !== String(value)) throw new Error(`${target.path} has no option ${value}`);
        return;
      }
      await app.key("ctrl-u");
      await app.type(String(value));
      // Tab commits the edit, as leaving the field does
      await app.key("tab");
    },

    async press(target, { wait = true } = {}) {
      if (!app) throw new Unsupported("no screen");
      const event = target.nav ? LEAVE_EVENT : target.event;
      // by the event it raises; a frontend-only wire (.eF) raises none - by its label then
      const ws = app.widgets();
      const byEvent = (f) => (target.nav ? f.nav : Boolean(event) && eventOf(f) === event);
      const byText = (f) => Boolean(target.text) && f.label === target.text && f.box === undefined;
      const match = ws.some(byEvent) ? byEvent : byText;
      const w = await tabTo(match, `action ${event || target.text}`);
      const p = app.key("enter");
      if (wait) await p;
      else p.catch(() => {});
      return w;
    },

    async closeBox({ action, text }) {
      if (!app || !session.messages.some((m) => m.kind === "box")) throw new Unsupported("no message box on the screen");
      await tabTo((f) => f.box !== undefined && (f.box === action || f.label === text), `box button ${action}`);
      await app.key("enter");
    },

    async back() {
      if (!app) throw new Unsupported("no screen");
      await app.key("alt-left");
    },

    async setModel() {
      throw new Unsupported("the terminal has no programmatic model access - only what a user types");
    },

    async settle() {
      if (session) await session.settle();
    },

    async state() {
      const s = emptyState();
      if (!session) return s;
      const st = session.state;
      const screen = app.screen();
      s.started = Boolean(st.id) || Boolean(session.error);
      s.app = st.app || null;
      s.id = st.id || null;
      for (const slot of Object.keys(s.slots)) {
        if (st.slots[slot]) s.slots[slot] = { open: true, text: slot === "NEST" || slot === "NEST2" ? app.layerText("MAIN") : app.layerText(slot) };
      }
      const edit = app.edit;
      for (const w of screen.widgets) {
        if (!w.path || Object.prototype.hasOwnProperty.call(s.values, w.path)) continue;
        const m = st.models[w.modelKey];
        const shown = edit && edit.key === w.key ? edit.buffer : w.value;
        s.values[w.path] = coerce(shown === undefined ? "" : shown, getAt((m && m.data) || {}, w.path));
      }
      for (const [k, m] of Object.entries(st.models)) s.models[k] = m.data;
      s.messages = session.messages.map((m) => ({ kind: m.kind, text: m.text, ...(m.type ? { type: m.type } : {}) }));
      s.error = session.error;
      s.log = [...session.log, ...screen.unsupported.map((u) => `unsupported: ${u.control}${u.id ? ` #${u.id}` : ""} (${u.slot}) - ${u.reason}`)];
      s.hash = session.hash;
      s.title = session.title;
      const f = app.focused();
      s.focus = f ? f.viewId || null : null;
      s.text = app.print({ width: WIDTH, color: false });
      s.screen = app.frame().lines.join("\n");
      return s;
    },

    async stop() {
      if (session) {
        session.stop();
        await session.settle().catch(() => {});
      }
      session = null;
      app = null;
    },

    async close() {},
  };
  return adapter;
}
