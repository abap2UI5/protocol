/*
 * Adapter: the official UI5 SPA - abap2UI5 app/webapp - in Chromium, driven
 * by Playwright through its real controls (typing into an Input, clicking a
 * Button). The page is the UI5 profile's boot page (ui5-page.mjs) served by
 * the mock at the run's endpoint, so the frontend posts its roundtrips to
 * the mock exactly as it posts them to a backend.
 *
 * Needs: an abap2UI5 checkout (ABAP2UI5_HOME, else ../abap2UI5 or
 * deps/abap2UI5 next to this repository), playwright-core and a Chromium
 * (PLAYWRIGHT_BROWSERS_PATH, CHROMIUM_BIN, or /opt/pw-browsers/chromium),
 * and the @openui5 npm packages of this repository's devDependencies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Unsupported, emptyState, sleep } from "./base.mjs";
import { bootPage, openui5Roots, versionInfo } from "./ui5-page.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PROBE = fs.readFileSync(path.join(HERE, "ui5-probe.js"), "utf8");

export function locateWebapp(explicit) {
  const candidates = [
    explicit,
    process.env.ABAP2UI5_HOME && path.join(process.env.ABAP2UI5_HOME, "app/webapp"),
    path.resolve(ROOT, "../abap2UI5/app/webapp"),
    path.resolve(ROOT, "deps/abap2UI5/app/webapp"),
  ].filter(Boolean);
  return candidates.find((d) => fs.existsSync(path.join(d, "core/Server.js"))) || null;
}

export async function launchChromium() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Unsupported("playwright-core is not installed (npm ci)");
  }
  const tries = [{}];
  for (const exe of [process.env.CHROMIUM_BIN, "/opt/pw-browsers/chromium"]) {
    if (exe && fs.existsSync(exe)) tries.push({ executablePath: exe });
  }
  let last;
  for (const t of tries) {
    try {
      return await chromium.launch({ ...t, args: ["--no-proxy-server"] });
    } catch (e) {
      last = e;
    }
  }
  throw new Unsupported(`no Chromium to drive (${String(last && last.message).split("\n")[0]}) - set CHROMIUM_BIN or install one with npx playwright-core install chromium`);
}

function gitHead(dir) {
  try {
    const repo = path.resolve(dir, "../..");
    const head = fs.readFileSync(path.join(repo, ".git/HEAD"), "utf8").trim();
    if (!head.startsWith("ref:")) return head.slice(0, 7);
    const ref = head.slice(5).trim();
    const file = path.join(repo, ".git", ref);
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim().slice(0, 7);
    const packed = fs.readFileSync(path.join(repo, ".git/packed-refs"), "utf8").split("\n").find((l) => l.endsWith(` ${ref}`));
    return packed ? packed.slice(0, 7) : "";
  } catch {
    return "";
  }
}

export function createUi5Adapter({ webapp: explicit, slowMo = 0 } = {}) {
  const webapp = locateWebapp(explicit);
  let browser = null;
  let context = null;
  let page = null;
  let run = null;
  let pageErrors = [];

  async function idle() {
    if (!page) return true;
    try {
      return await page.evaluate(() => Boolean(window.__conf && window.__conf.idle()));
    } catch {
      return false;
    }
  }

  const adapter = {
    name: "ui5",
    description: "the UI5 SPA (abap2UI5 app/webapp) in Chromium",
    profiles: ["core", "portable", "ui5"],
    capabilities: new Set(["dom", "url", "timers", "focus", "concurrent", "modelEdit", "boxClose", "nest", "title", "wires"]),

    async open({ mock }) {
      if (!webapp) throw new Unsupported("no abap2UI5 checkout with app/webapp (set ABAP2UI5_HOME)");
      const roots = openui5Roots();
      if (!roots.length) throw new Unsupported("the @openui5 npm packages are not installed (npm ci)");
      mock.addStatic({
        prefix: "/resources/",
        roots,
        maxAge: 3600,
        fallback: (rel) => (rel === "sap-ui-version.json"
          ? { status: 200, headers: { "content-type": "application/json" }, text: JSON.stringify(versionInfo(roots)) }
          : null),
      });
      mock.addStatic({ prefix: "/z2ui5/", roots: [webapp] });
      browser = await launchChromium();
      context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 800 } });
      await context.addInitScript(PROBE);
      const sha = gitHead(webapp);
      const pkg = (() => {
        try {
          return JSON.parse(fs.readFileSync(path.resolve(webapp, "../../package.json"), "utf8")).version;
        } catch {
          return "";
        }
      })();
      adapter.version = `abap2UI5 ${pkg}${sha ? ` (${sha})` : ""} app/webapp, OpenUI5 ${versionInfo(roots).version} (npm), Chromium ${browser.version()}`;
    },

    async start(r, { app, search, hash = "" } = {}) {
      run = r;
      run.page = () => bootPage();
      pageErrors = [];
      page = await context.newPage();
      if (slowMo) page.setDefaultTimeout(30_000);
      page.on("pageerror", (e) => pageErrors.push(String(e && e.message)));
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
        const ok = run.inflight === 0 && await idle();
        if (ok) {
          if (!since) since = Date.now();
          if (Date.now() - since >= 150) return;
        } else since = 0;
        await sleep(25);
      }
      throw new Error(`the UI5 frontend did not settle within ${timeout} ms`);
    },

    async locate(target) {
      const hit = await page.evaluate((spec) => window.__conf.locate(spec), target);
      if (hit.error) throw new Unsupported(hit.error);
      return hit;
    },

    async fill(target, value) {
      const hit = await adapter.locate(target);
      const sel = `[id="${hit.domId}"]`;
      if (hit.kind === "toggle") {
        if (Boolean(hit.current) !== Boolean(value)) await page.click(sel);
      } else if (hit.kind === "text") {
        await page.fill(sel, String(value));
        // UI5 writes the value into the model on change: focus leaving the field
        await page.locator(sel).blur();
      } else {
        throw new Unsupported(`${hit.control} is not a field this adapter can fill`);
      }
      await sleep(30);
    },

    /** Type without leaving the field (liveChange wires). */
    async type(target, text) {
      const hit = await adapter.locate(target);
      await page.locator(`[id="${hit.domId}"]`).pressSequentially(String(text));
    },

    async press(target, { wait = true } = {}) {
      const hit = await adapter.locate(target);
      await page.click(`[id="${hit.domId}"]`);
      if (wait) await adapter.settle();
    },

    async closeBox({ text, action }) {
      const hit = await adapter.locate({ box: text || action });
      await page.click(`[id="${hit.domId}"]`);
      await adapter.settle();
    },

    async back() {
      await page.goBack({ waitUntil: "commit" }).catch(() => {});
      await sleep(100);
      await adapter.settle();
    },

    async setModel(p, value, slot = "MAIN") {
      const r = await page.evaluate(([pp, v, s]) => {
        const req = (n) => sap.ui.require(n);
        const Component = req("sap/ui/core/Component");
        const c = Component.getComponentById("container-z2ui5");
        const view = req("z2ui5/core/ViewSlots").getView(c.ctx, s);
        if (!view) return "no view in slot";
        // what a control's two-way binding does: write through a binding,
        // which fires the model's propertyChange the frontend tracks
        const binding = view.getModel().bindProperty(pp);
        binding.setValue(v);
        binding.destroy();
        return "";
      }, [p, value, slot]);
      if (r) throw new Unsupported(r);
    },

    async evaluate(fn, arg) {
      return page.evaluate(fn, arg);
    },

    async state() {
      if (!page) return emptyState();
      const s = await page.evaluate(() => window.__conf.state());
      s.pageErrors = pageErrors.slice();
      return s;
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
