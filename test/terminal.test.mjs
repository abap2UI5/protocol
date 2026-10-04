// The terminal renderer (renderers/terminal/): golden screens of recorded
// responses (plain text, --print style, fixed width), the keys against the
// scripted backend down to the exact request body, width handling, colors
// and NO_COLOR, sanitising, the unknown-control placeholder, the CLI, and
// the generated mapping table. UPDATE_GOLDEN=1 rewrites the golden screens.
// The end-to-end run against the node-runtime reference host is in
// test/backends.test.mjs, next to the backend suite that starts the host.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import {
  printResponses, createSession, createTerminalApp, runTui, CONTROLS, colorWanted, strWidth, truncate, wrap, clean, keyName, parseRoute, fitColumns,
} from "../renderers/terminal/index.mjs";
import { TOLERATED } from "../renderers/common/view.mjs";
import { renderMapping, apply, README } from "../scripts/render-terminal.mjs";
import { startMock } from "../conformance/frontend/index.mjs";
import { load, ROOT } from "./lib/traffic.mjs";

const GOLDEN = path.join(ROOT, "renderers/terminal/golden");
const CLI = path.join(ROOT, "renderers/terminal/bin/abap2ui5-tui.mjs");
const suite = load("node-runtime", "suite.json");
const recorded = (id, ...which) => {
  const c = suite.checks.find((x) => x.id === id);
  return which.map((i) => c.exchanges[i].response.body);
};
const sampler = () => JSON.parse(fs.readFileSync(path.join(ROOT, "renderers/adaptive-cards/golden/sampler.response.json"), "utf8"));

/** The golden cases: the recorded responses the Adaptive Cards goldens use,
 *  the sampler, and the sampler narrow. */
const CASES = {
  "bind": { responses: () => recorded("model.scalar", 0) },
  "popup-over-main": { responses: () => recorded("slots.popup-destroy", 0, 1) },
  "popover": { responses: () => recorded("slots.popover", 0, 1) },
  "message-box": { responses: () => recorded("message.box-close-event", 0, 1) },
  "nav-target": { responses: () => recorded("nav.leave-reserved-event", 1) },
  "nest": { responses: () => recorded("slots.nest", 0, 1) },
  "sampler": { responses: () => [sampler()] },
  "sampler-40": { responses: () => [sampler()], width: 40 },
};

function messagesOf(responses) {
  // what the session would show: the follow-up messages of the last response
  const last = responses.at(-1);
  const custom = (last.S_FRONT.S_ACTION && last.S_FRONT.S_ACTION.T_CUSTOM) || [];
  return custom.filter((a) => a[0] === "MESSAGE_BOX" || a[0] === "MESSAGE_TOAST").map((a) => (a[0] === "MESSAGE_TOAST"
    ? { kind: "toast", text: a[2] }
    : { kind: "box", type: a[1], text: a[2], ...(a[3] || {}) }));
}

const screenOf = ({ text, unsupported }) => `${text}\n${unsupported.map((u) => `# unsupported: ${u.control}${u.id ? ` #${u.id}` : ""} (${u.slot}) - ${u.reason}`).join("\n")}${unsupported.length ? "\n" : ""}`;

// ------------------------------------------------------ golden screens ----

for (const [name, c] of Object.entries(CASES)) {
  test(`golden screen: ${name}`, () => {
    const rs = c.responses();
    const width = c.width || 80;
    const actual = screenOf(printResponses(rs, { width, messages: messagesOf(rs) }));
    for (const line of actual.split("\n")) {
      if (!line.startsWith("# ")) assert.ok(strWidth(line) <= width, `wider than ${width}: ${line}`);
      assert.ok(/^[\x20-\x7e]*$/.test(line), `not plain ASCII: ${line}`);
    }
    const file = path.join(GOLDEN, `${name}.txt`);
    if (process.env.UPDATE_GOLDEN) fs.writeFileSync(file, actual);
    assert.ok(fs.existsSync(file), `no golden screen ${name}.txt - UPDATE_GOLDEN=1 writes it`);
    assert.equal(actual, fs.readFileSync(file, "utf8"), `${name}: the screen changed - UPDATE_GOLDEN=1 rewrites renderers/terminal/golden/`);
  });
}

test("the screens say what the views say; the unknown control is a visible placeholder and reported", () => {
  const bind = printResponses(CASES.bind.responses()).text;
  assert.match(bind, /conformance - bind[\s\S]*\[start_+\][\s\S]*\[ \] Flag[\s\S]*\[Berlin_+\][\s\S]*\[ Check \] \[ Add row \][\s\S]*\[two_+\]/);
  const s = printResponses([sampler()]);
  assert.match(s.text, /\[\? com\.example\.unknown\.Gadget - not rendered\]/);
  assert.deepEqual(s.unsupported.map((u) => u.control), ["com.example.unknown.Gadget"]);
  // the box is an overlay with its details expanded as text
  const box = printResponses([recorded("message.box-close-event", 0)[0]], { messages: [{ kind: "box", type: "error", text: "it broke", details: "<p>detail <b>one</b></p><script>x()</script>" }] }).text;
  assert.match(box, /\+- Error -+\+\n\| it broke +\|\n\| +\|\n\| detail one +\|/);
  assert.ok(!box.includes("<") && !box.includes("x()"), box);
});

// ----------------------------------------------------------- the keys ----

/** A session + app against the scripted backend, started on `first`. */
async function started(mock, first, { width = 80, height = 30 } = {}) {
  const run = mock.run();
  run.reply({ body: first });
  const session = createSession({ url: run.url, location: (cls) => ({ origin: mock.origin, pathname: run.path, search: `?app_start=${cls}` }) });
  const app = createTerminalApp({ session, width, height });
  await session.start("Z2UI5_CL_CONF_X");
  return { run, session, app };
}

test("keys: Tab order, Up/Down by position, edits and a press -> exactly the request body the spec asks for", async () => {
  const mock = await startMock();
  try {
    const [first] = recorded("model.scalar", 0);
    const { run, app } = await started(mock, first);
    const order = app.widgets().map((w) => w.path || w.label);
    assert.deepEqual(order, ["/NAME", "/QTY", "/FLAG", "/S_ADDR/CITY", "/S_ADDR/ZIP", "Check", "Add row",
      "/T_ITEMS/0/TEXT", "/T_ITEMS/0/DONE", "/T_ITEMS/1/TEXT", "/T_ITEMS/1/DONE", "/T_ITEMS/2/TEXT", "/T_ITEMS/2/DONE"]);
    // the first field has the focus and is being edited: the cursor sits in it
    assert.equal(app.focused().path, "/NAME");
    const f0 = app.frame();
    assert.deepEqual(f0.cursor, { row: 3, col: 6 });
    assert.equal(f0.lines[0].trim(), "abap2UI5 - conformance - bind");
    assert.match(f0.lines.at(-1), /type to edit {2}Tab next {2}F1 keys {2}Ctrl\+C quit/);
    await app.key("ctrl-u");
    await app.type("Ada");
    await app.key("tab");
    await app.key("tab");
    await app.key("space"); // FLAG
    assert.equal(app.focused().path, "/FLAG");
    // Down twice from the check box: CITY, ZIP; Down again: the button line; Down: the first table row
    for (const k of ["down", "down", "down", "down"]) await app.key(k);
    assert.equal(app.focused().path, "/T_ITEMS/0/TEXT");
    await app.key("down");
    assert.equal(app.focused().path, "/T_ITEMS/1/TEXT");
    await app.key("end");
    await app.key("backspace");
    await app.key("backspace");
    await app.key("backspace");
    await app.type("zwei");
    // an edit typed and typed back is no edit: ZIP is left as it was
    await app.key("up");
    await app.key("up");
    await app.key("up");
    assert.equal(app.focused().path, "/S_ADDR/ZIP");
    await app.type("9");
    await app.key("backspace");
    // to the button above the table, and press
    await app.key("down");
    assert.equal(app.focused().label, "Check");
    run.reply({ body: recorded("model.scalar", 1)[0] });
    await app.key("enter");
    assert.deepEqual(run.posts()[1].json, {
      value: {
        S_FRONT: { ID: first.S_FRONT.ID, EVENT: "CHECK" },
        MODEL: { NAME: "Ada", FLAG: true, T_ITEMS: { __delta: { 1: { TEXT: "zwei" } } } },
      },
    });
    for (const p of run.posts()) {
      assert.equal(p.headers["content-type"], "application/json");
      assert.equal(p.headers["sap-contextid-accept"], "header");
    }
    // nothing edited since: the next press sends no MODEL
    run.reply({ body: recorded("model.table-grows", 1)[0] });
    while (app.focused().label !== "Add row") await app.key("tab");
    await app.key("enter");
    assert.deepEqual(run.posts()[2].json.value, { S_FRONT: { ID: recorded("model.scalar", 1)[0].S_FRONT.ID, EVENT: "ADD_ROW" } });
  } finally {
    await mock.close();
  }
});

test("keys: pick lists, toggles, a field's submit and the event arguments of a press", async () => {
  const mock = await startMock();
  try {
    const first = sampler();
    first.S_FRONT.ID = "S".repeat(32);
    const { run, app, session } = await started(mock, first);
    // the first field, not the back button, has the focus
    assert.equal(app.focused().path, "/NAME");
    // Enter in a field with a submit event: commit, then raise it
    await app.key("ctrl-u");
    await app.type("Grace");
    run.reply({ body: { S_FRONT: { ID: "T".repeat(32), APP: "Z2UI5_CL_CONF_X", PROTOCOL: 2 } } });
    await app.key("enter");
    assert.deepEqual(run.posts()[1].json.value, { S_FRONT: { ID: first.S_FRONT.ID, EVENT: "SUBMIT" }, MODEL: { NAME: "Grace" } });
    // the Select: Right picks the next option, Enter opens the list, Down + Enter picks
    while (app.focused().path !== "/COUNTRY") await app.key("tab");
    await app.key("right");
    assert.equal(session.state.models.MAIN.data.COUNTRY, "FR");
    await app.key("enter");
    assert.ok(app.picker);
    assert.match(app.frame().lines.join("\n"), /Pick[\s\S]*Germany[\s\S]*France/);
    await app.key("up");
    await app.key("enter");
    assert.equal(app.picker, null);
    assert.equal(session.state.models.MAIN.data.COUNTRY, "DE");
    // the MultiComboBox: Space ticks in the list
    while (app.focused().path !== "/TAGS") await app.key("shift-tab");
    await app.key("enter");
    await app.key("down");
    await app.key("space");
    await app.key("enter");
    assert.deepEqual(session.state.models.MAIN.data.TAGS, ["A", "B"]);
    // the segmented button: Left picks
    while (app.focused().path !== "/SIZE") await app.key("shift-tab");
    await app.key("left");
    assert.equal(session.state.models.MAIN.data.SIZE, "S");
    // a row of the selectable table: Space ticks it
    while (app.focused().path !== "/T_ITEMS/0/SEL") await app.key("tab");
    await app.key("space");
    // the row action of the second row raises itemPress with the row's ID
    while (!(app.focused().kind === "row" && app.focused().label === "row 2")) await app.key("tab");
    run.reply({ body: { S_FRONT: { ID: "U".repeat(32), APP: "Z2UI5_CL_CONF_X", PROTOCOL: 2 } } });
    await app.key("enter");
    assert.deepEqual(run.posts()[2].json.value, {
      S_FRONT: { ID: "T".repeat(32), EVENT: "ROW", T_EVENT_ARG: [2] },
      MODEL: { COUNTRY: "DE", TAGS: ["A", "B"], SIZE: "S", T_ITEMS: { __delta: { 0: { SEL: true } } } },
    });
    // Save in the footer: its ${/NAME} argument is read when it fires
    while (app.focused().label !== "Save") await app.key("tab");
    run.reply({ body: { S_FRONT: { ID: "V".repeat(32), APP: "Z2UI5_CL_CONF_X", PROTOCOL: 2 } } });
    await app.key("enter");
    assert.deepEqual(run.posts()[3].json.value.S_FRONT, { ID: "U".repeat(32), EVENT: "SAVE", T_EVENT_ARG: ["Grace", "literal"] });
    // the back button is reached with Alt+Left when there is no history
    run.reply({ body: { S_FRONT: { ID: "W".repeat(32), APP: "Z2UI5_CL_CONF_X", PROTOCOL: 2 } } });
    await app.key("alt-left");
    assert.equal(run.posts()[4].json.value.S_FRONT.EVENT, "___ZZZ_NAL");
    // the status line names the control that could not be rendered
    assert.match(app.status(), /not rendered: com\.example\.unknown\.Gadget/);
  } finally {
    await mock.close();
  }
});

test("keys: a message box takes the focus; its button raises onClose with the action; F1 and Esc", async () => {
  const mock = await startMock();
  try {
    const [main, box] = recorded("message.box-close-event", 0, 1);
    const { run, app, session } = await started(mock, main);
    run.reply({ body: box });
    while (app.focused().label !== "Confirm") await app.key("tab");
    await app.key("enter");
    assert.equal(app.focused().slot, "BOX");
    assert.deepEqual(app.widgets().map((w) => w.label), ["OK", "CANCEL"]);
    await app.key("f1");
    assert.match(app.frame().lines.join("\n"), /Keys[\s\S]*Tab \/ Shift\+Tab/);
    await app.key("escape");
    assert.equal(app.helpShown, false);
    run.reply({ body: recorded("message.box-close-event", 2)[0] });
    await app.key("right");
    await app.key("enter");
    const onClose = box.S_FRONT.S_ACTION.T_CUSTOM.find((a) => a[0] === "MESSAGE_BOX")[3].onClose;
    assert.deepEqual(run.posts()[2].json.value.S_FRONT, { ID: box.S_FRONT.ID, EVENT: onClose, T_EVENT_ARG: ["CANCEL"] });
    assert.ok(!session.messages.some((m) => m.kind === "box"));
  } finally {
    await mock.close();
  }
});

test("the session: cookies, basic auth, the CSRF token and the sap-contextid of a real system", async () => {
  const mock = await startMock();
  try {
    const run = mock.run().requireCsrf("tok-1");
    const [first] = recorded("model.scalar", 0);
    run.reply({ body: first, headers: { "set-cookie": "SAP_SESSIONID_X=abc; path=/; HttpOnly", "sap-contextid": "SID:ANON:1" } });
    run.reply({ body: recorded("model.scalar", 1)[0] });
    const session = createSession({ url: `${run.url}?sap-client=100`, user: "DEVELOPER", password: "pw", cookie: "MYSAPSSO2=t", location: undefined });
    const app = createTerminalApp({ session });
    await session.start("Z2UI5_CL_CONF_BIND");
    assert.equal(run.posts()[0].json.value.S_FRONT.SEARCH, "?sap-client=100&app_start=Z2UI5_CL_CONF_BIND");
    while (app.focused().label !== "Check") await app.key("tab");
    await app.key("enter");
    const posts = run.posts();
    const last = posts.at(-1);
    assert.equal(last.headers.authorization, `Basic ${Buffer.from("DEVELOPER:pw").toString("base64")}`);
    assert.equal(last.headers.cookie, "MYSAPSSO2=t; SAP_SESSIONID_X=abc");
    assert.equal(last.headers["x-csrf-token"], "tok-1");
    assert.equal(last.headers["sap-contextid"], "SID:ANON:1");
    assert.equal(last.json.value.S_FRONT.EVENT, "CHECK");
  } finally {
    await mock.close();
  }
});

// ------------------------------------------------- width, color, text ----

test("width: text wraps, columns shrink with an ellipsis, wide characters take two columns", () => {
  assert.equal(strWidth("abc"), 3);
  assert.equal(strWidth("\u65e5\u672c"), 4);
  assert.equal(strWidth("e\u0301"), 1);
  assert.equal(truncate("abcdefghij", 6), "abc...");
  assert.equal(truncate("\u65e5\u672c\u8a9e\u65e5\u672c", 7), "\u65e5\u672c...");
  assert.deepEqual(wrap("the quick brown fox", 9), ["the quick", "brown fox"]);
  assert.deepEqual(wrap("abcdefghijkl", 5), ["abcde", "fghij", "kl"]);
  assert.deepEqual(fitColumns([5, 40, 30], 50), [5, 23, 22]);
  const view = "<Text text=\"one two three four five six seven eight nine ten\"/>"
    + "<Table items=\"{/T}\"><columns><Column><Text text=\"Name\"/></Column><Column><Text text=\"Description of the program\"/></Column></columns>"
    + "<items><ColumnListItem><cells><Text text=\"{N}\"/><Text text=\"{D}\"/></cells></ColumnListItem></items></Table>";
  const r = { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 2, S_ACTION: { T_SYSTEM: [["VIEW_SLOTS", "display", "MAIN", `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">${view}</mvc:View>`]] } },
    MODEL: { T: [{ N: "Ada Lovelace", D: "wrote the first program for a machine that did not exist yet" }] } };
  const text = printResponses([r], { width: 30 }).text;
  for (const l of text.split("\n")) assert.ok(strWidth(l) <= 30, l);
  assert.match(text, /^one two three four five six\nseven eight nine ten\n/);
  // a cell wraps in its column, a header is cut with the ellipsis
  assert.match(text, /\nName {9}\| Description \.\.\.\n-{13}\+-{16}\nAda Lovelace \| wrote the first\n {13}\| program for a\n/);
});

test("colors: ANSI only when wanted - NO_COLOR, --no-color, FORCE_COLOR, a TTY", () => {
  const tty = { isTTY: true };
  assert.equal(colorWanted({ env: {}, stream: tty }), true);
  assert.equal(colorWanted({ env: { NO_COLOR: "1" }, stream: tty }), false);
  assert.equal(colorWanted({ env: { NO_COLOR: "" }, stream: tty }), true);
  assert.equal(colorWanted({ flag: false, env: {}, stream: tty }), false);
  assert.equal(colorWanted({ env: { TERM: "dumb" }, stream: tty }), false);
  assert.equal(colorWanted({ env: {}, stream: { isTTY: false } }), false);
  assert.equal(colorWanted({ env: { FORCE_COLOR: "1" }, stream: { isTTY: false } }), true);
  assert.equal(colorWanted({ env: { NO_COLOR: "1", FORCE_COLOR: "1" }, stream: tty }), false);
  const rs = [sampler()];
  const plain = printResponses(rs).text;
  const colored = printResponses(rs, { color: true }).text;
  assert.ok(!plain.includes("\x1b"));
  assert.match(colored, /\x1b\[1;33mWarning: \x1b\[0m\x1b\[33mCheck the amount\x1b\[0m/);
  // without color a field shows its extent with underscores; with color it is underlined
  assert.match(plain, /\[Ada_+\]/);
  assert.equal(colored.replace(/\x1b\[[0-9;]*m/g, "").split("\n").length, plain.split("\n").length);
});

test("text from the backend cannot reach the terminal as a control sequence", () => {
  assert.equal(clean("a\x1b]0;evil\x07b\x9bc\r\nd\te"), "a\ufffd]0;evil\ufffdb\ufffdc\nd    e");
  const [first] = recorded("model.scalar", 0);
  const evil = JSON.parse(JSON.stringify(first));
  evil.MODEL.NAME = "\x1b[2J\x1b]52;c;ZXZpbA==\x07";
  const out = printResponses([evil], { color: true, error: { text: "HTTP 500\n\x1b[31mboom" } }).text;
  // the only escape sequences are the renderer's own SGR styles
  assert.deepEqual(out.match(/\x1b(?!\[[0-9;]*m)/g), null);
  assert.ok(out.replace(/\x1b\[[0-9;]*m/g, "").includes("Error: HTTP 500"));
});

test("tty: readline keypresses map onto the app's key names; routes parse", () => {
  assert.equal(keyName("\r", { name: "return" }), "enter");
  assert.equal(keyName("\t", { name: "tab", shift: true }), "shift-tab");
  assert.equal(keyName("\x03", { name: "c", ctrl: true }), "ctrl-c");
  assert.equal(keyName("\x1b[1;3D", { name: "left", meta: true }), "alt-left");
  assert.deepEqual(keyName("a", { name: "a" }), { ch: "a" });
  assert.deepEqual(keyName("\u00e4", undefined), { ch: "\u00e4" });
  assert.equal(keyName("\x1b[20~", { name: "f9" }), null);
  assert.deepEqual(parseRoute("#/app/Z2UI5_CL_X/ABC"), { app: "Z2UI5_CL_X", draft: "ABC" });
  assert.deepEqual(parseRoute("#//app//NS/CL_X/ABC"), { app: "/NS/CL_X", draft: "ABC" });
  assert.deepEqual(parseRoute("#/app/Z2UI5_CL_X"), { app: "Z2UI5_CL_X", draft: "" });
  assert.equal(parseRoute("#/z2ui5-xapp-state=ABC"), null);
});

test("tty: runTui draws frames on an alternate screen, takes keys, restores the terminal and ends the session", async () => {
  const mock = await startMock();
  try {
    const [first] = recorded("model.scalar", 0);
    const { run, app, session } = await started(mock, first);
    const input = new PassThrough();
    const output = new EventEmitter();
    output.columns = 60;
    output.rows = 16;
    let written = "";
    output.write = (s) => {
      written += s;
      return true;
    };
    const done = runTui({ app, input, output });
    assert.match(written, /^\x1b\[\?1049h/);
    assert.match(written, /abap2UI5 - conformance - bind/);
    // the cursor is placed in the field being edited
    assert.match(written, /\x1b\[4;7H\x1b\[\?25h/);
    input.write("Z");
    await new Promise((r) => setTimeout(r, 20));
    assert.match(written, />startZ_+</);
    output.columns = 40;
    output.emit("resize");
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(app.width, 40);
    run.reply({ body: recorded("model.scalar", 1)[0] });
    for (const k of ["\t", "\t", "\t", "\t", "\t", "\r"]) input.write(k);
    await session.settle();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(run.posts()[1].json.value.MODEL.NAME, "startZ");
    input.write("\x03");
    await done;
    assert.match(written, /\x1b\[\?25h\x1b\[\?1049l$/);
  } finally {
    await mock.close();
  }
});

// ------------------------------------------------------------ the CLI ----

const cli = (args, env = {}) => new Promise((resolve) => {
  execFile(process.execPath, [CLI, ...args], { env: { ...process.env, NO_COLOR: "", FORCE_COLOR: "", ...env } }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr }));
});

test("the CLI: --print renders the first screen as text, reports what it could not render; usage errors", async () => {
  const mock = await startMock();
  try {
    const run = mock.run();
    run.reply({ body: sampler() });
    const r = await cli([run.url, "--app", "Z2UI5_CL_CONF_X", "--print", "--width", "80", "--no-color"]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(screenOf({ text: r.stdout.replace(/\n$/, ""), unsupported: [] }), `${fs.readFileSync(path.join(GOLDEN, "sampler.txt"), "utf8").split("\n# unsupported")[0]}\n`);
    assert.match(r.stderr, /unsupported: com\.example\.unknown\.Gadget \(MAIN\)/);
    assert.equal(run.posts()[0].json.value.S_FRONT.SEARCH, "?app_start=Z2UI5_CL_CONF_X");
    // NO_COLOR and FORCE_COLOR as the environment says
    const run2 = mock.run();
    run2.reply({ body: sampler() });
    const forced = await cli([run2.url, "--print"], { FORCE_COLOR: "1" });
    assert.match(forced.stdout, /\x1b\[/);
    const run3 = mock.run();
    run3.reply({ body: sampler() });
    const no = await cli([run3.url, "--print"], { FORCE_COLOR: "1", NO_COLOR: "1" });
    assert.ok(!no.stdout.includes("\x1b"));
    // an error answer: shown, exit code 1
    const run4 = mock.run();
    run4.reply({ status: 500, headers: { "content-type": "text/plain" }, body: "boom" });
    const err = await cli([run4.url, "--print", "--app", "X"]);
    assert.equal(err.code, 1);
    assert.match(err.stdout, /^Error: HTTP 500\n {7}boom/);
  } finally {
    await mock.close();
  }
  assert.equal((await cli([])).code, 2);
  assert.equal((await cli(["not a url"])).code, 2);
  assert.equal((await cli(["http://x/", "--bogus"])).code, 2);
  const help = await cli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /usage: abap2ui5-tui <url>/);
  // without a terminal and without --print it says so
  assert.equal((await cli(["http://127.0.0.1:9/"])).code, 2);
});

// ------------------------------------------------------- the generated ----

test("every control of portable profile v1 has a terminal mapping entry, and nothing else does", () => {
  const profile = JSON.parse(fs.readFileSync(path.join(ROOT, "profiles/portable-v1.json"), "utf8"));
  assert.deepEqual(Object.keys(CONTROLS).sort(), Object.keys(profile.controls).sort());
  for (const name of Object.keys(profile.controls)) assert.equal(TOLERATED.has(name), Boolean(profile.controls[name].tolerated), name);
  for (const [name, m] of Object.entries(CONTROLS)) {
    assert.equal(typeof m.render, "function", name);
    assert.ok(m.terminal, `${name}: no terminal text`);
    assert.ok(/^[\x20-\x7e]*$/.test(m.terminal + m.note), `${name}: not ASCII`);
  }
});

test("renderers/terminal/README.md's mapping table is up to date (node scripts/render-terminal.mjs)", () => {
  const md = fs.readFileSync(README, "utf8");
  assert.equal(apply(md, renderMapping()), md);
});
