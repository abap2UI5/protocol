// spec/navigation.md - the URL of a frontend that has one.
import { answer, display, mainView, recordedUi5, draftId } from "../responses.mjs";
import { startApp, NEXT, nextButton } from "./common.mjs";

const N = "spec/navigation.md";

export default [
  {
    id: "router.keep",
    title: "Under KEEP routing the hash is #/app/<APP>/<ID> of the last response",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: `${N}#the-nav-section`,
    async run(t) {
      const first = recordedUi5("ROUTE: page load");
      t.mock.reply(first);
      await t.start("Z2UI5_CL_CONF_ROUTE");
      let s = await t.state();
      t.equal(s.hash, `#/app/Z2UI5_CL_CONF_ROUTE/${first.body.S_FRONT.ID}`, "location.hash after the KEEP response");
      const counted = recordedUi5("ROUTE: COUNT");
      t.mock.reply(counted);
      await t.press({ text: "Count", event: "COUNT" });
      s = await t.state();
      t.equal(s.hash, `#/app/Z2UI5_CL_CONF_ROUTE/${counted.body.S_FRONT.ID}`, "location.hash after a response without NAV (the new ID either way)");
    },
  },
  {
    id: "router.hash-sent",
    title: "Requests carry the non-empty hash as HASH",
    level: "SHOULD",
    profile: "core",
    needs: ["url"],
    spec: `${N}#routes`,
    async run(t) {
      const first = recordedUi5("ROUTE: page load");
      t.mock.reply(first);
      await t.start("Z2UI5_CL_CONF_ROUTE");
      t.mock.reply(recordedUi5("ROUTE: COUNT"));
      await t.press({ text: "Count", event: "COUNT" });
      await t.posted(2);
      t.equal(t.front(1).HASH, `#/app/Z2UI5_CL_CONF_ROUTE/${first.body.S_FRONT.ID}`, "S_FRONT.HASH of the event");
    },
  },
  {
    id: "router.back-restores",
    title: "Browser Back after a routed nav_app_call sends an app-start-shaped request with the caller's route",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: `${N}#routes`,
    async run(t) {
      t.mock.reply(recordedUi5("ROUTE: page load"));
      await t.start("Z2UI5_CL_CONF_ROUTE");
      t.mock.reply(recordedUi5("ROUTE: COUNT"));
      await t.press({ text: "Count", event: "COUNT" });
      const call = recordedUi5("ROUTE: CALL");
      t.mock.reply(call);
      await t.press({ text: "Call", event: "CALL" });
      const opts = call.body.S_FRONT.NAV;
      let s = await t.state();
      t.equal(s.hash, `#/app/Z2UI5_CL_CONF_NAV_TGT/${call.body.S_FRONT.ID}`, "location.hash after the call");
      t.mock.reply(recordedUi5("ROUTE: browser Back to the route of the caller"));
      await t.back();
      await t.posted(4);
      const f = t.front(3);
      t.ok(!f.ID, `the restore carries ID ${f.ID} - it must be app-start-shaped`);
      t.equal(f.HASH, `#/app/${opts.navAppCallPrevApp}/${opts.navAppCallPrevId}`, "S_FRONT.HASH of the restore");
      t.deepEqual(f.ROUTE, { APP: opts.navAppCallPrevApp, DRAFT: opts.navAppCallPrevId }, "S_FRONT.ROUTE of the restore (the route, parsed)");
      s = await t.state();
      t.equal(s.app, "Z2UI5_CL_CONF_ROUTE", "the app after the restore");
    },
  },
  {
    id: "router.app-state",
    title: "setAppStateActive writes #/z2ui5-xapp-state=<ID>; a response without it clears it",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: `${N}#the-app-state-hash`,
    async run(t) {
      await startApp(t, nextButton);
      const on = answer({ nav: { setAppStateActive: true } });
      t.mock.reply(on);
      await t.press(NEXT);
      let s = await t.state();
      t.equal(s.hash, `#/z2ui5-xapp-state=${on.body.S_FRONT.ID}`, "location.hash with the app state active");
      t.mock.reply(answer({ views: { MAIN: display(mainView(nextButton, { title: "another view" })) } }));
      await t.press(NEXT);
      s = await t.state();
      t.ok(!String(s.hash || "").includes("z2ui5-xapp-state"), `the app-state hash stayed: ${s.hash}`);
    },
  },
  {
    id: "router.start-route",
    title: "An app start carries what the hash names parsed, as ROUTE { APP, DRAFT } - inside a launchpad hash the app part only",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: "spec/request.md#route",
    async run(t) {
      const draft = draftId();
      const hash = `#Conformance-display&/app/Z2UI5_CL_CONF_ROUTE/${draft}`;
      t.mock.reply(recordedUi5("ROUTE: page load"));
      await t.start("", { search: "", hash });
      const f = t.front(0);
      t.ok(!f.ID, `the app start carries ID ${f.ID}`);
      t.deepEqual(f.ROUTE, { APP: "Z2UI5_CL_CONF_ROUTE", DRAFT: draft }, "S_FRONT.ROUTE of the app start");
      t.equal(f.HASH, hash, "S_FRONT.HASH (the hash as it is, next to its parse)");
    },
  },
  {
    id: "router.start-app-state",
    title: "An app start on an app-state link carries its draft as ROUTE { APP_STATE }",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: "spec/request.md#route",
    async run(t) {
      const restored = recordedUi5("ECHO: restore via the app-state hash");
      const draft = draftId();
      t.mock.reply(restored);
      await t.start("Z2UI5_CL_CONF_ECHO", { hash: `#/z2ui5-xapp-state=${draft}` });
      const f = t.front(0);
      t.deepEqual(f.ROUTE, { APP_STATE: draft }, "S_FRONT.ROUTE of the app start");
      const s = await t.state();
      t.equal(s.hash, `#/z2ui5-xapp-state=${restored.body.S_FRONT.ID}`, "location.hash after the restore (setAppStateActive: the new ID)");
    },
  },
  {
    id: "router.no-route-on-events",
    title: "ROUTE travels with a request that names no draft only - never with an event",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: "spec/request.md#route",
    async run(t) {
      t.mock.reply(recordedUi5("ROUTE: page load"));
      await t.start("Z2UI5_CL_CONF_ROUTE");
      t.ok(!Object.prototype.hasOwnProperty.call(t.front(0), "ROUTE"), `an app start without a hash carries ROUTE ${JSON.stringify(t.front(0).ROUTE)}`);
      t.mock.reply(recordedUi5("ROUTE: COUNT"));
      await t.press({ text: "Count", event: "COUNT" });
      await t.posted(2);
      t.ok(t.front(1).HASH, "the event was sent from a page without a route in its hash");
      t.ok(!Object.prototype.hasOwnProperty.call(t.front(1), "ROUTE"), `an event carries ROUTE ${JSON.stringify(t.front(1).ROUTE)}`);
    },
  },
  {
    id: "router.hash-write-owner",
    title: "setPushState is written to the URL only for an app that owns the hash - a listener registered (setHashEvent), routing off",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: `${N}#the-app-owned-hash`,
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ nav: { setPushState: "/conformance/unowned" } }));
      await t.press(NEXT);
      let s = await t.state();
      t.ok(!String(s.hash || "").includes("conformance/unowned"), `a hash was written for an app without a listener: ${s.hash}`);
      t.mock.reply(answer({ nav: { setHashEvent: "HASH_CHANGED", setPushState: "/conformance/owned" } }));
      await t.press(NEXT);
      s = await t.state();
      t.ok(String(s.hash || "").includes("conformance/owned"), `the hash of an app with a listener was not written: ${s.hash}`);
    },
  },
];
