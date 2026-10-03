/*
 * Adapter: the agent client of abap2UI5/mcp-server (lib/appclient.mjs, the
 * engine behind the MCP tools app_start / app_act) - vendored in
 * vendor/mcp-server/ at the commit vendor/mcp-server/source.json names, or
 * loaded from a checkout (MCP_SERVER_HOME, option `home`). A frontend of the
 * semantic profile: it renders nothing and answers every roundtrip with a
 * snapshot v1 (profiles/semantic.md).
 *
 * Interactions map onto the client's API: fill -> act({ values }), press ->
 * act({ event }), closeBox -> act({ event: <onClose>, args: [action] }).
 * A refusal of the client itself ("no action 'X' on this screen") is an
 * Unsupported interaction; a refusal of the backend (an error status, no
 * JSON, no S_FRONT) is the error the frontend shows.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Unsupported, emptyState } from "./base.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VENDORED = path.join(HERE, "vendor/mcp-server");

const BACKEND_REFUSAL = /^the backend (did not answer|refused|answered)/;

export function createAgentAdapter({ home = process.env.MCP_SERVER_HOME } = {}) {
  let mod = null;
  let mock = null;
  let client = null;
  let snapshot = null;
  let error = null;
  let inflight = [];

  function remember(promise) {
    const p = promise.then((s) => {
      snapshot = s;
      error = null;
      return s;
    }, (e) => {
      if (e && e.name === "AgentError" && BACKEND_REFUSAL.test(e.message)) {
        error = { text: e.message };
        return null;
      }
      if (e && e.name === "AgentError") throw new Unsupported(`the agent client refused: ${e.message}`);
      throw e;
    });
    inflight.push(p);
    p.finally(() => { inflight = inflight.filter((x) => x !== p); }).catch(() => {});
    return p;
  }

  const adapter = {
    name: "agent",
    description: "the agent client of abap2UI5/mcp-server (lib/appclient.mjs), in process",
    profiles: ["core", "semantic"],
    capabilities: new Set(["snapshot", "boxClose", "concurrent"]),

    async open({ mock: m }) {
      mock = m;
      const file = home ? path.join(home, "lib/appclient.mjs") : path.join(VENDORED, "appclient.mjs");
      if (!fs.existsSync(file)) throw new Unsupported(`no agent client at ${file}`);
      mod = await import(pathToFileURL(file).href);
      if (home) {
        adapter.version = `abap2UI5/mcp-server lib/appclient.mjs from ${home}`;
      } else {
        const src = JSON.parse(fs.readFileSync(path.join(VENDORED, "source.json"), "utf8"));
        adapter.version = `abap2UI5/mcp-server lib/appclient.mjs @ ${src.commit.slice(0, 7)} (vendored)`;
      }
    },

    async start(run, { app, search } = {}) {
      snapshot = null;
      error = null;
      if (search !== undefined && !app) throw new Unsupported("the agent client starts apps by class name only");
      client = mod.createAppClient({
        baseUrl: run.url,
        backendHint: "",
        // what an embedder passes on a real system: the launch URL of the endpoint
        location: (cls) => ({ origin: mock.origin, pathname: run.path, search: `?app_start=${encodeURIComponent(cls)}` }),
      });
      await remember(client.start(app));
    },

    async fill(target, value) {
      if (!snapshot) throw new Unsupported("no screen to fill");
      if (!target.path) throw new Unsupported("the agent client addresses fields by model path");
      await remember(client.act(snapshot.session, { values: { [target.path]: value } }));
    },

    async press(target, { wait = true } = {}) {
      if (!snapshot) throw new Unsupported("no screen to act on");
      const event = target.nav ? "___ZZZ_NAL" : target.event;
      if (!event) throw new Unsupported("the agent client fires events by name - the target names none");
      const p = remember(client.act(snapshot.session, { event, ...(target.args ? { args: target.args } : {}), ...(target.row !== undefined ? { row: target.row } : {}) }));
      if (wait) await p;
      else p.catch(() => {});
    },

    async closeBox({ action }) {
      const a = snapshot && snapshot.actions.find((x) => x.control === "sap.m.MessageBox");
      if (!a) throw new Unsupported("no message box with a close event on the screen");
      await remember(client.act(snapshot.session, { event: a.event, args: [action] }));
    },

    async back() {
      throw new Unsupported("the agent client has no browser history");
    },

    async setModel(p, value) {
      return adapter.fill({ path: p }, value);
    },

    async settle() {
      await Promise.allSettled(inflight);
    },

    async state() {
      const s = emptyState();
      s.error = error;
      if (!snapshot) return s;
      s.started = true;
      s.snapshot = snapshot;
      s.app = snapshot.app || null;
      s.id = snapshot.session || null;
      const layers = new Set([snapshot.layer, ...snapshot.fields.map((f) => f.layer), ...snapshot.actions.map((a) => a.layer), ...snapshot.tables.map((t) => t.layer)]);
      const describe = (layer) => [
        snapshot.layer === layer ? snapshot.title : "",
        ...snapshot.fields.filter((f) => f.layer === layer).map((f) => `${f.label} ${f.value ?? ""}`),
        ...snapshot.actions.filter((a) => a.layer === layer).map((a) => a.label),
        ...snapshot.tables.filter((t) => t.layer === layer).map((t) => `${t.label} ${t.rows.map((r) => Object.values(r).join(" ")).join(" ")}`),
        ...(snapshot.layer === layer || (layer === "main" && snapshot.layer === "popover") ? snapshot.texts : []),
      ].filter(Boolean).join(" ");
      s.slots.MAIN = { open: true, text: describe("main") };
      s.slots.POPUP = { open: layers.has("popup"), text: describe("popup") };
      s.slots.POPOVER = { open: layers.has("popover"), text: describe("popover") };
      for (const f of snapshot.fields) s.values[f.path] = f.value;
      s.messages = snapshot.messages.filter((m) => m.source === "toast" || m.source === "box").map((m) => ({ kind: m.source, text: m.text, type: m.type }));
      s.log = snapshot.unsupported.slice();
      s.text = [s.slots.MAIN.text, s.slots.POPUP.text, s.slots.POPOVER.text].join(" ");
      return s;
    },

    async stop() {
      await Promise.allSettled(inflight);
      client = null;
    },

    async close() {},
  };
  return adapter;
}
