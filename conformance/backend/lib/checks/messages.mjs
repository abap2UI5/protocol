// spec/actions.md#messages - toast and message box.
const A = "spec/actions.md#messages";
import { actions } from "../client.mjs";

export default [
  {
    id: "message.toast",
    title: "A toast is the follow-up action [\"MESSAGE_TOAST\", \"show\", <text>]",
    level: "MUST",
    profile: "core",
    spec: A,
    async run(t) {
      const r = await t.event(await t.start("MSG"), "TOAST");
      t.deepEqual(actions(r), [["MESSAGE_TOAST", "show", "conformance toast"]], "S_FRONT.ACTIONS");
    },
  },
  {
    id: "message.box",
    title: "A message box is [\"MESSAGE_BOX\", <type>, <text>]",
    level: "MUST",
    profile: "core",
    spec: A,
    async run(t) {
      const r = await t.event(await t.start("MSG"), "BOX");
      t.deepEqual(actions(r), [["MESSAGE_BOX", "error", "conformance box"]], "S_FRONT.ACTIONS");
    },
  },
  {
    id: "message.box-options",
    title: "A message box with buttons and a close event carries them as its option object",
    level: "MUST",
    profile: "core",
    spec: A,
    async run(t) {
      const r = await t.event(await t.start("MSG"), "BOX_CONFIRM");
      t.deepEqual(actions(r), [["MESSAGE_BOX", "confirm", "conformance confirm", { actions: ["OK", "CANCEL"], onClose: "BOX_CLOSED" }]], "S_FRONT.ACTIONS");
    },
  },
  {
    id: "message.box-close-event",
    title: "The close event of a box arrives with the pressed action as its first argument",
    level: "MUST",
    profile: "core",
    spec: A,
    async run(t) {
      const box = await t.event(await t.start("MSG"), "BOX_CONFIRM");
      const r = await t.event(box, "BOX_CLOSED", { args: ["CANCEL"] });
      t.equal(r.json.MODEL && r.json.MODEL.LAST_ACTION, "CANCEL", "MODEL.LAST_ACTION");
    },
  },
];
