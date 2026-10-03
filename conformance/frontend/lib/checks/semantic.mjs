// profiles/semantic.md - agent snapshot v1, for frontends that do not render.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, formatErrors } from "../../../backend/lib/schema.mjs";
import { recorded, answer } from "../responses.mjs";
import { startApp, NEXT, nextButton } from "./common.mjs";

const S = "profiles/semantic.md";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export default [
  {
    id: "semantic.snapshot-schema",
    title: "Every snapshot matches schema/snapshot.schema.json",
    level: "MUST",
    profile: "semantic",
    needs: ["snapshot"],
    spec: `${S}#snapshot-v1`,
    async run(t) {
      t.mock.reply(recorded("model.scalar", 0));
      await t.start("Z2UI5_CL_CONF_BIND");
      const shots = [(await t.state()).snapshot];
      await t.fill({ path: "/NAME" }, "Ada");
      shots.push((await t.state()).snapshot);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press({ text: "Check", event: "CHECK" });
      shots.push((await t.state()).snapshot);
      shots.forEach((s, i) => {
        const v = validate("snapshot", s);
        t.ok(v.valid, `snapshot #${i + 1}: ${formatErrors(v.errors)}`);
      });
    },
  },
  {
    id: "semantic.recorded-snapshots",
    title: "Replayed recorded traffic gives the recorded snapshots (traffic/node-runtime/agent-client.json)",
    level: "SHOULD",
    profile: "semantic",
    needs: ["snapshot"],
    spec: `${S}#snapshot-v1`,
    async run(t) {
      const rec = JSON.parse(fs.readFileSync(path.join(ROOT, "traffic/node-runtime/agent-client.json"), "utf8"));
      // the script of scripts/record-traffic.mjs recordAgentClient
      const steps = [
        ["start", "Z2UI5_CL_CONF_BIND"],
        ["act", { values: { "/NAME": "Ada", "/T_ITEMS/1/TEXT": "zwei" }, event: "CHECK" }],
        ["start", "Z2UI5_CL_CONF_MSG"],
        ["act", { event: "BOX_CONFIRM" }],
        ["start", "Z2UI5_CL_CONF_SLOTS"],
        ["act", { event: "POPUP_OPEN" }],
        ["start", "Z2UI5_CL_CONF_NAV"],
        ["act", { event: "CALL" }],
        ["act", { event: "DONE" }],
      ];
      steps.forEach((_, i) => t.mock.reply({ status: rec.exchanges[i].response.status, body: rec.exchanges[i].response.body }));
      for (let i = 0; i < steps.length; i += 1) {
        const [kind, arg] = steps[i];
        if (kind === "start") await t.start(arg);
        else {
          for (const [p, v] of Object.entries(arg.values || {})) await t.fill({ path: p }, v);
          await t.press({ event: arg.event });
        }
        const got = (await t.state()).snapshot;
        t.deepEqual(got, rec.snapshots[i].snapshot, `snapshot after "${rec.snapshots[i].label}"`);
      }
    },
  },
  {
    id: "semantic.timer-action",
    title: "START_TIMER is offered as an action with trigger timer",
    level: "MUST",
    profile: "semantic",
    needs: ["snapshot"],
    spec: `${S}#actions`,
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ custom: [["START_TIMER", "TICK", "500"]] }));
      await t.press(NEXT);
      const snap = (await t.state()).snapshot;
      t.ok(snap.actions.some((a) => a.event === "TICK" && a.trigger === "timer"), `no timer action: ${JSON.stringify(snap.actions)}`);
    },
  },
];
