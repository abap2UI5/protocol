// profiles/ui5.md - what the UI5 profile adds on top of the core protocol:
// the page, and views that are UI5 XML with the abap2UI5 wire forms in them.
const U = "profiles/ui5.md";
import { displayOf } from "../client.mjs";

export default [
  {
    id: "ui5.page",
    title: "GET of the endpoint answers the HTML page that boots the UI5 frontend",
    level: "MUST",
    profile: "ui5",
    spec: `${U}#the-page`,
    async run(t) {
      const r = await t.client.raw({ method: "GET", label: "GET page" });
      t.equal(r.status, 200, "HTTP status");
      t.ok(/^text\/html\b/i.test(r.headers["content-type"] || ""), `Content-Type must be text/html, is "${r.headers["content-type"]}"`);
      t.ok(r.text.includes("sap-ui-bootstrap"), "the page carries the UI5 bootstrap script");
      t.ok(/data-sap-ui-component/.test(r.text), "the page carries the component container");
    },
  },
  {
    id: "ui5.page-revalidation",
    title: "The page carries an ETag and answers a matching If-None-Match with 304",
    level: "SHOULD",
    profile: "ui5",
    spec: `${U}#the-page`,
    async run(t) {
      const r = await t.client.raw({ method: "GET", label: "GET page" });
      const etag = r.headers.etag;
      t.ok(etag, "the page should carry an ETag");
      const again = await t.client.raw({ method: "GET", headers: { "if-none-match": etag }, label: "GET page again" });
      t.equal(again.status, 304, "status of a revalidation");
    },
  },
  {
    id: "ui5.view-roots",
    title: "MAIN and nested views are sap.ui.core.mvc.View XML, popups and popovers core:FragmentDefinition",
    level: "MUST",
    profile: "ui5",
    spec: `${U}#views`,
    async run(t) {
      const start = await t.start("SLOTS");
      t.ok(/^<mvc:View\b/.test(displayOf(start, "MAIN")[3]), "MAIN view root");
      const popup = await t.event(start, "POPUP_OPEN");
      t.ok(/^<core:FragmentDefinition\b/.test(displayOf(popup, "POPUP")[3]), "POPUP root");
      const nest = await t.event(start, "NEST_OPEN");
      t.ok(/^<mvc:View\b/.test(displayOf(nest, "NEST")[3]), "NEST view root");
    },
  },
  {
    id: "ui5.binding-paths",
    title: "Bound attributes appear in views as absolute model paths, table cells as relative ones",
    level: "MUST",
    profile: "ui5",
    spec: `${U}#bindings`,
    async run(t) {
      const xml = displayOf(await t.start("BIND"), "MAIN")[3];
      for (const part of ['value="{/NAME}"', 'selected="{/FLAG}"', 'value="{/S_ADDR/CITY}"', 'items="{/T_ITEMS}"', 'value="{TEXT}"']) {
        t.ok(xml.includes(part), `the view should contain ${part}`);
      }
    },
  },
  {
    id: "ui5.event-wire",
    title: "A backend event is wired as .eB(['<EVENT>'], <args>...)",
    level: "MUST",
    profile: "ui5",
    spec: `${U}#event-wires`,
    async run(t) {
      const xml = displayOf(await t.start("ECHO"), "MAIN")[3];
      t.ok(xml.includes(`press=".eB(['ECHO'], 'alpha', 'beta')"`), "the ECHO button's wire");
      t.ok(xml.includes(`press=".eB(['NOOP'])"`), "the NOOP button's wire");
    },
  },
  {
    id: "ui5.leave-wire",
    title: "The leave wire is .eB(['___ZZZ_NAL'])",
    level: "MUST",
    profile: "ui5",
    spec: `${U}#event-wires`,
    async run(t) {
      const called = await t.event(await t.start("NAV"), "CALL");
      t.ok(displayOf(called, "MAIN")[3].includes(`navButtonPress=".eB(['___ZZZ_NAL'])"`), "the target's navButtonPress");
    },
  },
  {
    id: "ui5.frontend-wire",
    title: "A frontend action wired into a view is .eF('<ACTION>', <args>...)",
    level: "MUST",
    profile: "ui5",
    spec: `${U}#event-wires`,
    async run(t) {
      const xml = displayOf(await t.start("ACTIONS"), "MAIN")[3];
      t.ok(xml.includes(`press=".eF('SET_TITLE', 'wired title')"`), "the wired SET_TITLE");
      const popup = await t.event(await t.start("SLOTS"), "POPUP_OPEN");
      t.ok(displayOf(popup, "POPUP")[3].includes(`press=".eF('CONTROL_GLOBAL', 'VIEW_SLOTS', 'destroy', 'POPUP')"`), "the popup's frontend close");
    },
  },
];
