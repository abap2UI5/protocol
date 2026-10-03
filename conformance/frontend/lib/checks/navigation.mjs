// spec/navigation.md - the URL of a frontend that has one.
import { answer, router, display, mainView, recordedUi5 } from "../responses.mjs";
import { startApp, NEXT, nextButton } from "./common.mjs";

const N = "spec/navigation.md";

export default [
  {
    id: "router.keep",
    title: "Under KEEP routing the hash is #/app/<APP>/<ID> of the last response",
    level: "MUST",
    profile: "core",
    needs: ["url"],
    spec: `${N}#the-router-action`,
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
      t.equal(s.hash, `#/app/Z2UI5_CL_CONF_ROUTE/${counted.body.S_FRONT.ID}`, "location.hash after a response without ROUTER (the new ID either way)");
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
      const opts = call.body.S_FRONT.S_ACTION.T_SYSTEM.find((a) => a[0] === "ROUTER")[2];
      let s = await t.state();
      t.equal(s.hash, `#/app/Z2UI5_CL_CONF_NAV_TGT/${call.body.S_FRONT.ID}`, "location.hash after the call");
      t.mock.reply(recordedUi5("ROUTE: browser Back to the route of the caller"));
      await t.back();
      await t.posted(4);
      const f = t.front(3);
      t.ok(!f.ID, `the restore carries ID ${f.ID} - it must be app-start-shaped`);
      t.equal(f.HASH, `#/app/${opts.navAppCallPrevApp}/${opts.navAppCallPrevId}`, "S_FRONT.HASH of the restore");
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
      const on = answer({ system: [router({ setAppStateActive: true })] });
      t.mock.reply(on);
      await t.press(NEXT);
      let s = await t.state();
      t.equal(s.hash, `#/z2ui5-xapp-state=${on.body.S_FRONT.ID}`, "location.hash with the app state active");
      t.mock.reply(answer({ system: [display("MAIN", mainView(nextButton, { title: "another view" }))] }));
      await t.press(NEXT);
      s = await t.state();
      t.ok(!String(s.hash || "").includes("z2ui5-xapp-state"), `the app-state hash stayed: ${s.hash}`);
    },
  },
];
