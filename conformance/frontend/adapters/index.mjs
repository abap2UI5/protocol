// The frontends the suite can drive, by adapter name. Each module is loaded
// only when its adapter is asked for, so the suite has no static dependency
// on a browser driver.
export const ADAPTERS = Object.freeze({
  ui5: { module: "./ui5.mjs", factory: "createUi5Adapter", description: "the UI5 SPA (abap2UI5 app/webapp) in Chromium via Playwright" },
  agent: { module: "./agent.mjs", factory: "createAgentAdapter", description: "the agent client of abap2UI5/mcp-server (lib/appclient.mjs)" },
  webcomponent: { module: "./webcomponent.mjs", factory: "createWebComponentAdapter", description: "the UI5 Web Components frontend (abap2UI5/frontend-webcomponent dist/abap2ui5-wc.js) in Chromium" },
  "adaptive-cards": { module: "./adaptive-cards.mjs", factory: "createAdaptiveCardsAdapter", description: "the Adaptive Cards renderer prototype of this repository (renderers/adaptive-cards/), in process" },
  headless: { module: "./headless.mjs", factory: "createHeadlessAdapter", description: "the headless ABAP simulator (abap2UI5/headless-frontend) - not drivable yet" },
});

export async function createAdapter(name, options = {}) {
  const a = ADAPTERS[name];
  if (!a) throw new Error(`unknown adapter "${name}" - ${Object.keys(ADAPTERS).join(", ")}`);
  const mod = await import(a.module);
  return mod[a.factory](options);
}
