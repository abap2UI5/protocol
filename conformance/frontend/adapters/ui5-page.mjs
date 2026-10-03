/*
 * The page the UI5 adapter boots the official UI5 SPA (abap2UI5 app/webapp)
 * with - the UI5 profile's page (profiles/ui5.md#the-page) as the backend
 * serves it (z2ui5_cl_ui5_http_handler=>_http_get), with two differences:
 *
 *   - the frontend is loaded from the webapp folder of an abap2UI5 checkout
 *     (resource root z2ui5 -> /z2ui5/) instead of the inline preload, so
 *     the suite tests the frontend source as it is;
 *   - UI5 itself comes from the @openui5/* npm packages of this repository
 *     (/resources/), so the run needs no CDN.
 *
 * The component settings are the backend page's: checkLocal: true - the
 * frontend posts to the URL of the page, the run's endpoint.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** The source roots of the @openui5 packages installed next to this package
 *  (sap.ui.core, sap.m and what sap.m depends on), or [] without them. */
export function openui5Roots() {
  const roots = [];
  let base;
  try {
    base = path.dirname(path.dirname(require.resolve("@openui5/sap.ui.core/package.json")));
  } catch {
    return roots;
  }
  for (const name of fs.readdirSync(base)) {
    const src = path.join(base, name, "src");
    if (fs.existsSync(src)) roots.push(src);
  }
  return roots;
}

/** sap-ui-version.json as the UI5 build writes it - the npm source packages
 *  carry none, and the frontend reads the UI5 version from it
 *  (sap/ui/VersionInfo -> CONFIG.S_UI5). */
export function versionInfo(roots) {
  const libraries = [];
  let version = "";
  for (const root of roots) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "..", "package.json"), "utf8"));
      const name = pkg.name.replace(/^@openui5\//, "");
      libraries.push({ name, version: pkg.version, buildTimestamp: "202601010000", scmRevision: "" });
      if (name === "sap.ui.core") version = pkg.version;
    } catch { /* not a package */ }
  }
  return {
    name: "OpenUI5 Distribution (npm source packages)",
    version,
    buildTimestamp: "202601010000",
    scmRevision: "",
    gav: `com.sap.openui5.dist:sdk:${version}`,
    libraries,
  };
}

/*
 * The page's oninit, in place of the backend page's onInitComponent (which
 * registers the inline preload and runs ComponentSupport): it loads the
 * frontend's MAIN controller class first and counts the responses it is
 * processing (window.__confProcessing) - the adapter's "is the frontend
 * idle" needs it, because the frontend marks a response processed before
 * its views are built - and records what reaches sap.m.MessageToast /
 * MessageBox (window.__confMessages). Then it runs ComponentSupport like
 * the backend page. Nothing of the frontend's behaviour is changed.
 */
const ONINIT = `window.__confProcessing = 0;
window.__confMessages = [];
window.conformanceInit = function () {
  sap.ui.require(["z2ui5/controller/View1.controller", "sap/m/MessageToast", "sap/m/MessageBox"], function (View1, Toast, Box) {
    var proto = View1.prototype, process = proto._processAfterRendering;
    proto._processAfterRendering = function () {
      window.__confProcessing += 1;
      var done = function () { window.__confProcessing -= 1; };
      var r;
      try { r = process.apply(this, arguments); } catch (e) { done(); throw e; }
      Promise.resolve(r).then(done, done);
      return r;
    };
    var show = Toast.show;
    Toast.show = function (text) {
      window.__confMessages.push({ kind: "toast", text: String(text) });
      return show.apply(this, arguments);
    };
    ["show", "alert", "confirm", "error", "information", "warning", "success"].forEach(function (m) {
      var orig = Box[m];
      if (typeof orig !== "function") return;
      Box[m] = function (text) {
        window.__confMessages.push({ kind: "box", type: m, text: typeof text === "string" ? text : String(text) });
        return orig.apply(this, arguments);
      };
    });
    sap.ui.require(["sap/ui/core/ComponentSupport"], function (ComponentSupport) { ComponentSupport.run(); });
  });
};`;

export function bootPage({ theme = "sap_horizon" } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>abap2UI5</title>
<style>html, body, body > div, #container, #container-uiarea { height: 100%; }</style>
<script>${ONINIT}</script>
<script id="sap-ui-bootstrap" src="/resources/sap-ui-core.js"
  data-sap-ui-resourceroots='{ "z2ui5": "/z2ui5/" }'
  data-sap-ui-oninit="conformanceInit"
  data-sap-ui-compatVersion="edge" data-sap-ui-async="true" data-sap-ui-frameOptions="trusted"
  data-sap-ui-bindingSyntax="complex" data-sap-ui-theme="${theme}"></script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content">
<div data-sap-ui-component data-name="z2ui5" data-id="container"
  data-settings='{"id" : "z2ui5", "componentData" : {"checkLocal" : true}}' data-handle-validation="true"></div>
</body>
</html>`;
}
