// The Adaptive Cards renderer prototype (renderers/adaptive-cards/): golden
// cards of recorded responses and of a synthetic sampler, a structural check
// of every card against Adaptive Cards 1.5, the reverse step (payload ->
// request), the host against the scripted backend, and the generated mapping
// table. UPDATE_GOLDEN=1 rewrites the golden cards.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  renderResponses, submitToRequest, createCardHost, cardText, walk, CONTROLS, TOLERATED, CARD_VERSION,
} from "../renderers/adaptive-cards/index.mjs";
import { renderMapping, apply, README } from "../scripts/render-adaptive-cards.mjs";
import { startMock } from "../conformance/frontend/index.mjs";
import { load, ROOT } from "./lib/traffic.mjs";

const GOLDEN = path.join(ROOT, "renderers/adaptive-cards/golden");
const suite = load("node-runtime", "suite.json");
const recorded = (id, ...which) => {
  const c = suite.checks.find((x) => x.id === id);
  return which.map((i) => c.exchanges[i].response.body);
};
const sampler = () => JSON.parse(fs.readFileSync(path.join(GOLDEN, "sampler.response.json"), "utf8"));

/** The golden cases: recorded responses (folded in order) and the sampler. */
const CASES = {
  "bind": () => recorded("model.scalar", 0),
  "popup-over-main": () => recorded("slots.popup-destroy", 0, 1),
  "popover": () => recorded("slots.popover", 0, 1),
  "message-box": () => recorded("message.box-close-event", 0, 1),
  "nav-target": () => recorded("nav.leave-reserved-event", 1),
  "nest": () => recorded("slots.nest", 0, 1),
  "sampler": () => [sampler()],
};

function messagesOf(responses) {
  // what the host would show: the follow-up messages of the last response
  const last = responses.at(-1);
  const custom = (last.S_FRONT.S_ACTION && last.S_FRONT.S_ACTION.T_CUSTOM) || [];
  return custom.filter((a) => a[0] === "MESSAGE_BOX" || a[0] === "MESSAGE_TOAST").map((a) => (a[0] === "MESSAGE_TOAST"
    ? { kind: "toast", text: a[2] }
    : { kind: "box", type: a[1], text: a[2], ...(a[3] || {}) }));
}

// ------------------------------------------------- Adaptive Cards 1.5 ----

const ELEMENTS = new Set(["TextBlock", "RichTextBlock", "Image", "Container", "ColumnSet", "FactSet", "ActionSet", "Table",
  "Input.Text", "Input.Number", "Input.Date", "Input.Time", "Input.Toggle", "Input.ChoiceSet"]);
const ACTIONS = new Set(["Action.Submit", "Action.OpenUrl"]);
const ENUMS = {
  color: ["Default", "Dark", "Light", "Accent", "Good", "Warning", "Attention"],
  size: ["Default", "Small", "Medium", "Large", "ExtraLarge"],
  weight: ["Default", "Lighter", "Bolder"],
};

/** The problems of a card against the Adaptive Cards 1.5 schema - the
 *  subset of it this renderer writes. */
function cardProblems(card) {
  const out = [];
  if (card.type !== "AdaptiveCard" || card.version !== CARD_VERSION) out.push("not an AdaptiveCard 1.5");
  const ids = new Set();
  const action = (a, where) => {
    if (!ACTIONS.has(a.type)) out.push(`${where}: unknown action ${a.type}`);
    if (a.type === "Action.OpenUrl" && !a.url) out.push(`${where}: Action.OpenUrl without url`);
    if (a.data !== undefined && (typeof a.data !== "object" || Array.isArray(a.data))) out.push(`${where}: data is no object`);
  };
  const element = (e, where) => {
    if (!ELEMENTS.has(e.type)) out.push(`${where}: unknown element ${e.type}`);
    if (e.type === "TextBlock" && typeof e.text !== "string") out.push(`${where}: TextBlock without text`);
    if (e.type === "TextBlock" && e.style && !["default", "heading"].includes(e.style)) out.push(`${where}: TextBlock style ${e.style}`);
    for (const [k, vals] of Object.entries(ENUMS)) if (e.type === "TextBlock" && e[k] !== undefined && !vals.includes(e[k])) out.push(`${where}: ${k} ${e[k]}`);
    if (e.type === "Container" && e.style && !["default", "emphasis", "good", "attention", "warning", "accent"].includes(e.style)) out.push(`${where}: Container style ${e.style}`);
    if (e.type.startsWith("Input.")) {
      if (!e.id) out.push(`${where}: input without id`);
      if (ids.has(e.id)) out.push(`${where}: duplicate id ${e.id}`);
      ids.add(e.id);
    }
    if (e.type === "Input.Toggle" && !e.title) out.push(`${where}: Input.Toggle without title`);
    if (e.type === "Input.ChoiceSet" && !(e.choices && e.choices.length)) out.push(`${where}: Input.ChoiceSet without choices`);
    if (e.type === "Input.Date" && e.value && !/^\d{4}-\d{2}-\d{2}$/.test(e.value)) out.push(`${where}: Input.Date value ${e.value}`);
    if (e.type === "Input.Number" && e.value !== undefined && typeof e.value !== "number") out.push(`${where}: Input.Number value ${e.value}`);
    if (e.type === "FactSet" && !e.facts.every((f) => typeof f.title === "string" && typeof f.value === "string")) out.push(`${where}: fact without title/value`);
    if (e.type === "ActionSet") e.actions.forEach((a, i) => action(a, `${where}.actions[${i}]`));
    if (e.type === "ColumnSet") e.columns.forEach((c, i) => { if (c.type !== "Column") out.push(`${where}.columns[${i}]: no Column`); });
    if (e.type === "Table") {
      for (const [r, row] of e.rows.entries()) {
        if (row.type !== "TableRow") out.push(`${where}.rows[${r}]: no TableRow`);
        if (row.cells.length > e.columns.length) out.push(`${where}.rows[${r}]: more cells than columns`);
        for (const c of row.cells) if (c.type !== "TableCell") out.push(`${where}.rows[${r}]: no TableCell`);
      }
    }
    if (e.inlineAction) action(e.inlineAction, `${where}.inlineAction`);
    if (e.selectAction) action(e.selectAction, `${where}.selectAction`);
  };
  let n = 0;
  walk(card.body, (e) => {
    n += 1;
    if (e.type && e.type.startsWith("Action.")) return;
    element(e, `#${n} ${e.type}`);
  });
  return out;
}

for (const [name, responses] of Object.entries(CASES)) {
  test(`golden card: ${name}`, () => {
    const rs = responses();
    const { card, unsupported } = renderResponses(rs, { messages: messagesOf(rs) });
    assert.deepEqual(cardProblems(card), [], "the card breaks the Adaptive Cards 1.5 schema");
    const file = path.join(GOLDEN, `${name}.card.json`);
    const actual = { card, unsupported };
    if (process.env.UPDATE_GOLDEN) fs.writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    assert.ok(fs.existsSync(file), `no golden card ${name}.card.json - UPDATE_GOLDEN=1 writes it`);
    assert.deepEqual(actual, JSON.parse(fs.readFileSync(file, "utf8")), `${name}: the card changed - UPDATE_GOLDEN=1 rewrites renderers/adaptive-cards/golden/`);
  });
}

test("the cards say what the views say", () => {
  const bind = renderResponses(CASES.bind()).card;
  assert.match(cardText(bind.body), /conformance - bind.*start.*Berlin.*Check.*Add row.*one.*two.*three/);
  const popup = renderResponses(CASES["popup-over-main"]()).card;
  assert.deepEqual(popup.body.map((c) => c.id), ["slot-POPUP", "slot-MAIN"]);
  // MAIN under a modal popup is read-only: no inputs, no actions
  const kinds = [];
  walk(popup.body.find((c) => c.id === "slot-MAIN").items, (e) => kinds.push(e.type));
  assert.ok(!kinds.some((k) => k.startsWith("Input.") || k.startsWith("Action.") || k === "ActionSet"), kinds.join());
  const { unsupported } = renderResponses([sampler()]);
  assert.deepEqual(unsupported.map((u) => u.control), ["com.example.unknown.Gadget"]);
});

// ---------------------------------------------------- the reverse step ----

test("an Action.Submit payload becomes the next request: changed inputs as the model delta", () => {
  const { state } = renderResponses(CASES.bind());
  const r = submitToRequest(state, {
    event: "CHECK", "/NAME": "Ada", "/QTY": "1", "/FLAG": "true", "/S_ADDR/CITY": "Paris", "/S_ADDR/ZIP": "10115",
    "/T_ITEMS/0/TEXT": "one", "/T_ITEMS/0/DONE": "false", "/T_ITEMS/1/TEXT": "zwei", "/T_ITEMS/1/DONE": "true", "/T_ITEMS/2/TEXT": "three", "/T_ITEMS/2/DONE": "false",
  });
  assert.equal(r.kind, "event");
  assert.deepEqual(r.edits, ["/NAME", "/FLAG", "/S_ADDR/CITY", "/T_ITEMS/1/TEXT", "/T_ITEMS/1/DONE"]);
  assert.deepEqual(r.request, {
    S_FRONT: { ID: state.id, EVENT: "CHECK" },
    MODEL: { NAME: "Ada", FLAG: true, S_ADDR: { CITY: "Paris", ZIP: "10115" }, T_ITEMS: { __delta: { 1: { TEXT: "zwei", DONE: true } } } },
  });
  // nothing changed: no MODEL, no T_EVENT_ARG
  assert.deepEqual(submitToRequest(state, { event: "ADD_ROW", "/NAME": "start", "/QTY": "1" }).request, { S_FRONT: { ID: state.id, EVENT: "ADD_ROW" } });
});

test("arguments read from the model are read after the edits of the same submit; other kinds of action", () => {
  const { state } = renderResponses([sampler()]);
  const save = submitToRequest(state, { event: "SAVE", args: ["Ada", "literal"], refs: ["/NAME"], "/NAME": "Grace" });
  assert.deepEqual(save.request.S_FRONT.T_EVENT_ARG, ["Grace", "literal"]);
  assert.deepEqual(save.request.MODEL, { NAME: "Grace" });
  const tags = submitToRequest(state, { event: "X", "/TAGS": "A,B", "/AMOUNT": "13" });
  assert.deepEqual(tags.request.MODEL, { TAGS: ["A", "B"], AMOUNT: 13 });
  const popup = renderResponses(CASES["popup-over-main"]()).state;
  const close = submitToRequest(popup, { client: ["CONTROL_GLOBAL", "VIEW_SLOTS", "destroy", "POPUP"], slot: "POPUP", "/POPUP_TEXT": "typed" });
  assert.equal(close.kind, "client");
  assert.deepEqual(close.edits, ["/POPUP_TEXT"]);
  const ev = submitToRequest(popup, { event: "POPUP_CLOSE", slot: "POPUP", "/POPUP_TEXT": "typed" });
  assert.deepEqual(ev.request.MODEL, { POPUP_TEXT: "typed" });
  assert.equal(submitToRequest(popup, { box: "OK" }).kind, "box");
  assert.throws(() => submitToRequest(popup, { "/X": 1 }), /names no event/);
});

// ------------------------------------------------------------ the host ----

test("the host: app start, a submit, a box close, an app change and an error, against the scripted backend", async () => {
  const mock = await startMock();
  try {
    const run = mock.run();
    const [main, popover] = recorded("slots.popover", 0, 1);
    run.reply({ body: main });
    run.reply({ body: popover });
    run.reply({ body: { S_FRONT: { APP: "Z2UI5_CL_OTHER", ID: "B".repeat(32), PROTOCOL: 2, S_ACTION: { T_CUSTOM: [["MESSAGE_BOX", "confirm", "sure?", { actions: ["OK", "CANCEL"], onClose: "CLOSED" }], ["X_UNKNOWN", 1]] } } } });
    run.reply({ status: 500, headers: { "content-type": "text/plain" }, body: "boom <b>x</b>" });
    const host = createCardHost({ url: run.url });
    await host.start("Z2UI5_CL_CONF_SLOTS");
    assert.deepEqual(run.posts()[0].json, { value: { S_FRONT: { ORIGIN: mock.origin, PATHNAME: run.path, SEARCH: "?app_start=Z2UI5_CL_CONF_SLOTS" } } });
    await host.submit({ event: "POPOVER_OPEN" });
    assert.ok(host.state.slots.POPOVER);
    // a press in MAIN closes the popover first; the answer of another app would have taken it down anyway
    await host.submit({ event: "POPUP_OPEN" });
    assert.ok(!host.state.slots.POPOVER);
    assert.equal(host.state.app, "Z2UI5_CL_OTHER");
    assert.ok(host.log.some((l) => /unknown follow-up action: X_UNKNOWN/.test(l)), host.log.join("\n"));
    const box = host.render().card.body.find((e) => e.id === "message-box");
    assert.deepEqual(box.items.at(-1).actions.map((a) => a.data), [{ box: "OK" }, { box: "CANCEL" }]);
    await host.submit({ box: "CANCEL" });
    assert.deepEqual(run.posts()[3].json.value.S_FRONT, { ID: "B".repeat(32), EVENT: "CLOSED", T_EVENT_ARG: ["CANCEL"] });
    assert.equal(host.error.text, "HTTP 500\nboom <b>x</b>");
    const err = host.render().card.body.find((e) => e.id === "error");
    assert.equal(err.items[0].inlines[0].text, "HTTP 500\nboom <b>x</b>");
    for (const p of run.posts()) {
      assert.equal(p.headers["content-type"], "application/json");
      assert.equal(p.headers["sap-contextid-accept"], "header");
    }
  } finally {
    await mock.close();
  }
});

// ------------------------------------------------------- the generated ----

test("every control of portable profile v1 has a mapping entry, and nothing else does", () => {
  const profile = JSON.parse(fs.readFileSync(path.join(ROOT, "profiles/portable-v1.json"), "utf8"));
  assert.deepEqual(Object.keys(CONTROLS).sort(), Object.keys(profile.controls).sort());
  for (const [name, c] of Object.entries(profile.controls)) assert.equal(TOLERATED.has(name), Boolean(c.tolerated), name);
  for (const [name, m] of Object.entries(CONTROLS)) {
    assert.equal(typeof m.render, "function", name);
    assert.ok(m.card, `${name}: no card text`);
    assert.ok(/^[\x20-\x7e]*$/.test(m.card + m.note), `${name}: not ASCII`);
  }
});

test("renderers/adaptive-cards/README.md's mapping table is up to date (node scripts/render-adaptive-cards.mjs)", () => {
  const md = fs.readFileSync(README, "utf8");
  assert.equal(apply(md, renderMapping()), md);
});
