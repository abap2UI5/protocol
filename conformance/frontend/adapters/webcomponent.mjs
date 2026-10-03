/*
 * Adapter: the UI5 Web Components frontend (abap2UI5/frontend-webcomponent,
 * the custom element <abap2ui5-app> of dist/abap2ui5-wc.js) in Chromium,
 * driven by Playwright. A portable-profile renderer.
 *
 * The page is the frontend's own standalone page (its dist/index.html):
 * <abap2ui5-app endpoint=<the run's endpoint> app=<?app_start> standalone>,
 * served by the mock at the endpoint with the bundle under /wc/.
 *
 * Needs a built checkout: WC_FRONTEND_HOME (else ../frontend-webcomponent)
 * with dist/abap2ui5-wc.js (`npm run build` there). The frontend is under
 * construction; the adapter reads its state through the element's public
 * surface (session, diagnostics(), the abap2ui5-* events) plus the
 * data-ui5-id / data-ui5-control attributes its renderer writes, and reports
 * an interaction it cannot address as Unsupported.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Unsupported, emptyState, sleep } from "./base.mjs";
import { launchChromium } from "./ui5.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function locateWebComponentDist(explicit) {
  const candidates = [
    explicit,
    process.env.WC_FRONTEND_HOME && path.join(process.env.WC_FRONTEND_HOME, "dist"),
    path.resolve(ROOT, "../frontend-webcomponent/dist"),
  ].filter(Boolean);
  return candidates.find((d) => fs.existsSync(path.join(d, "abap2ui5-wc.js"))) || null;
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>abap2UI5</title>
<style>html, body { margin: 0; height: 100%; } abap2ui5-app { height: 100vh; }</style>
<script>
  window.__wcEvents = [];
  for (const type of ["abap2ui5-response", "abap2ui5-request", "abap2ui5-message", "abap2ui5-error", "abap2ui5-diagnostic", "abap2ui5-title"]) {
    document.addEventListener(type, (e) => window.__wcEvents.push({ type, detail: JSON.parse(JSON.stringify(e.detail || {})) }));
  }
</script>
<script type="module">
  import "/wc/abap2ui5-wc.js";
  const url = new URL(location.href);
  const el = document.createElement("abap2ui5-app");
  el.setAttribute("endpoint", url.pathname);
  el.setAttribute("app", url.searchParams.get("app_start") || "Z2UI5_CL_UI5_APP_HI_WORLD");
  el.setAttribute("standalone", "");
  document.body.appendChild(el);
</script></head><body></body></html>`;

/* Runs in the page: the element's state, normalized. */
function pageState() {
  const host = document.querySelector("abap2ui5-app");
  const app = host && host._app;
  const ev = window.__wcEvents || [];
  const out = {
    started: Boolean(app), app: null, id: null, slots: {}, values: {}, models: {}, messages: [], error: null, log: [],
    hash: location.hash, title: document.title, focus: null, text: "", xss: Boolean(window.__confXss),
  };
  for (const e of ev) {
    if (e.type === "abap2ui5-message") out.messages.push({ kind: e.detail.type === "box" ? "box" : "toast", text: String(e.detail.text || ""), type: e.detail.messageType || e.detail.method });
    if (e.type === "abap2ui5-error") out.error = { text: String(e.detail.message || "") };
  }
  if (!app) return out;
  const st = app.session.state;
  out.app = st.app || null;
  out.id = st.id || null;
  const textOf = (nodes) => nodes.map((n) => (n.innerText !== undefined ? n.innerText : n.textContent) || "").join(" ").replace(/\s+/g, " ").trim();
  for (const k of ["MAIN", "NEST", "NEST2", "POPUP", "POPOVER"]) {
    const e = app.slots[k];
    if (!e) {
      out.slots[k] = { open: false, text: "" };
      continue;
    }
    const nodes = k === "MAIN" ? [app.mainEl] : (e.holder ? [e.holder] : e.nodes);
    out.slots[k] = { open: e.popup ? Boolean(e.popup.open) : true, text: textOf(nodes) };
  }
  for (const k of ["MAIN", "POPUP", "POPOVER"]) {
    const m = app.session.models[k];
    if (m) out.models[k] = JSON.parse(JSON.stringify(m.data));
  }
  out.log = app.diagnostics().map((d) => `${d.kind}: ${d.detail}`);
  const a = host.shadowRoot.activeElement;
  out.focus = a ? (a.getAttribute("data-ui5-id") || a.id || null) : null;
  out.text = textOf([app.rootEl]);
  return out;
}

/* Runs in the page: the element to interact with. */
function pageLocate(spec) {
  const host = document.querySelector("abap2ui5-app");
  const app = host && host._app;
  if (!app) return { error: "the frontend has not started" };
  const slot = spec.slot || "MAIN";
  const e = app.slots[slot];
  if (!e) return { error: `slot ${slot} is not open` };
  const roots = slot === "MAIN" ? [app.mainEl] : (e.holder ? [e.holder] : e.nodes);
  const all = roots.flatMap((r) => [r, ...r.querySelectorAll("*")]);
  let el = null;
  if (spec.id) el = all.find((n) => n.getAttribute && n.getAttribute("data-ui5-id") === spec.id);
  else if (spec.text) el = all.find((n) => /^UI5-(BUTTON|LINK|TOGGLE-BUTTON)$/.test(n.tagName) && (n.textContent || n.getAttribute("text") || "").trim() === spec.text);
  else if (spec.nav) el = all.find((n) => n.getAttribute && /nav/i.test(n.getAttribute("data-a2u-role") || n.className || "") && n.tagName === "UI5-BUTTON");
  if (!el) return { error: `no element for ${JSON.stringify(spec)} in slot ${slot}` };
  if (!el.id) el.id = `__conf_${Math.random().toString(36).slice(2)}`;
  const tag = el.tagName;
  const kind = /^UI5-(CHECKBOX|SWITCH|TOGGLE-BUTTON)$/.test(tag) ? "toggle" : (/^UI5-(INPUT|TEXTAREA|STEP-INPUT|DATE-PICKER)$/.test(tag) ? "text" : "click");
  return { id: el.id, kind, tag, current: el.checked ?? el.pressed };
}

export function createWebComponentAdapter({ dist: explicit } = {}) {
  const dist = locateWebComponentDist(explicit);
  let browser = null;
  let context = null;
  let page = null;
  let run = null;

  const sel = (hit) => `abap2ui5-app >> [id="${hit.id}"]`;

  const adapter = {
    name: "webcomponent",
    description: "the UI5 Web Components frontend (abap2UI5/frontend-webcomponent) in Chromium",
    profiles: ["core", "portable"],
    capabilities: new Set(["dom", "url", "timers", "title", "concurrent"]),

    async open({ mock }) {
      if (!dist) throw new Unsupported("no frontend-webcomponent build (dist/abap2ui5-wc.js) - set WC_FRONTEND_HOME and run npm run build there");
      mock.addStatic({ prefix: "/wc/", roots: [dist], maxAge: 3600 });
      browser = await launchChromium();
      context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 800 } });
      let version = "";
      try {
        version = JSON.parse(fs.readFileSync(path.join(dist, "../package.json"), "utf8")).version;
      } catch { /* no package.json next to dist */ }
      adapter.version = `@abap2ui5/frontend-webcomponent ${version} (${dist}), Chromium ${browser.version()}`;
    },

    async start(r, { app, search, hash = "" } = {}) {
      run = r;
      run.page = () => PAGE;
      page = await context.newPage();
      page.on("dialog", (d) => d.dismiss().catch(() => {}));
      const s = search !== undefined ? search : (app ? `?app_start=${app}` : "");
      await page.goto(`${run.url}${s}${hash}`);
      await run.waitPosts(1, 30_000);
      await adapter.settle();
    },

    async settle({ timeout = 15_000 } = {}) {
      const t0 = Date.now();
      let since = 0;
      while (Date.now() - t0 < timeout) {
        let idle = false;
        try {
          idle = run.inflight === 0 && await page.evaluate(() => {
            const host = document.querySelector("abap2ui5-app");
            return Boolean(host && host._app && !host._app.session.busy);
          });
        } catch { /* navigating */ }
        if (idle) {
          if (!since) since = Date.now();
          if (Date.now() - since >= 200) return;
        } else since = 0;
        await sleep(25);
      }
      throw new Error(`the web component frontend did not settle within ${timeout} ms`);
    },

    async locate(target) {
      const hit = await page.evaluate(pageLocate, target);
      if (hit.error) throw new Unsupported(hit.error);
      return hit;
    },

    async fill(target, value) {
      const hit = await adapter.locate(target);
      if (hit.kind === "toggle") {
        if (Boolean(hit.current) !== Boolean(value)) await page.click(sel(hit));
      } else if (hit.kind === "text") {
        const inner = page.locator(sel(hit)).locator("input, textarea").first();
        await inner.fill(String(value));
        await inner.press("Enter").catch(() => {});
        await inner.blur();
      } else throw new Unsupported(`${hit.tag} is not a field this adapter can fill`);
      await sleep(50);
    },

    async type(target, text) {
      const hit = await adapter.locate(target);
      await page.locator(sel(hit)).locator("input, textarea").first().pressSequentially(String(text));
    },

    async press(target, { wait = true } = {}) {
      const hit = await adapter.locate(target);
      await page.click(sel(hit));
      if (wait) await adapter.settle();
    },

    async closeBox() {
      throw new Unsupported("closing a message box is not wired in this adapter yet");
    },

    async back() {
      await page.goBack({ waitUntil: "commit" }).catch(() => {});
      await sleep(100);
      await adapter.settle();
    },

    async setModel() {
      throw new Unsupported("no model edit hook");
    },

    async evaluate(fn, arg) {
      return page.evaluate(fn, arg);
    },

    async state() {
      if (!page) return emptyState();
      return page.evaluate(pageState);
    },

    async stop() {
      if (page) await page.close().catch(() => {});
      page = null;
    },

    async close() {
      await adapter.stop();
      if (browser) await browser.close().catch(() => {});
      browser = null;
    },
  };
  return adapter;
}
