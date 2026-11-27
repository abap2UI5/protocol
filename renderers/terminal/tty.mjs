/*
 * The terminal renderer on a real TTY: raw keys in (node:readline's
 * keypress events), frames out (ANSI: the alternate screen, the cursor
 * placed in the field being edited), redrawn on every key, every session
 * change and every resize. Effects of follow-up actions: SET_TITLE sets the
 * window title (OSC 0), CLIPBOARD_COPY the clipboard (OSC 52) - with text
 * cleaned of control characters first. Bracketed paste is on while it runs:
 * what is pasted goes into the focused field as text (app.paste), its line
 * feeds and tabs never submit or move the focus.
 *
 *   await runTui({ app, input: process.stdin, output: process.stdout });
 */
import readline from "node:readline";
import { clean } from "./text.mjs";

const NAMES = {
  return: "enter", enter: "enter", escape: "escape", space: "space", tab: "tab", backspace: "backspace", delete: "delete",
  up: "up", down: "down", left: "left", right: "right", home: "home", end: "end", pageup: "pageup", pagedown: "pagedown",
  f1: "f1", f4: "f4",
};

/** A readline keypress -> the key name app.key takes, or null. */
export function keyName(str, key) {
  if (!key || !key.name) return str && !/[\x00-\x1f\x7f]/.test(str) ? { ch: str } : null;
  const n = key.name;
  if (key.ctrl && /^[a-z]$/.test(n)) return `ctrl-${n}`;
  if (key.meta && (n === "left" || n === "right")) return `alt-${n}`;
  if (key.meta && n === "b") return "alt-left";
  if (key.meta && n === "f") return "alt-right";
  if (n === "tab" && key.shift) return "shift-tab";
  if (NAMES[n]) return NAMES[n];
  if (str && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(str)) return { ch: str };
  return null;
}

/**
 * Run the app until it quits (Ctrl+C / Ctrl+Q). Resolves after the screen
 * is restored and the session terminated.
 */
export function runTui({ app, input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve) => {
    const write = (s) => output.write(s);
    let closed = false;
    let pending = false;
    let pasting = null; // the text of a bracketed paste, until it ends
    // what runTui turns on is turned off on every way out - finish(), and
    // an exit or a signal that ends the process before it
    const RESTORE = "\x1b[?2004l\x1b[?25h\x1b[?1049l";
    const onExit = () => {
      if (!closed) write(RESTORE);
    };
    const onSignal = (signal) => {
      onExit();
      closed = true;
      process.exit(128 + (signal === "SIGHUP" ? 1 : 15));
    };

    function draw() {
      if (closed) return;
      for (const e of app.session.takeEffects()) {
        if (e.kind === "title") write(`\x1b]0;${clean(e.text, { keepNewlines: false })}\x07`);
        if (e.kind === "clipboard") write(`\x1b]52;c;${Buffer.from(String(e.text)).toString("base64")}\x07`);
      }
      const { lines, cursor } = app.frame();
      let out = "\x1b[H";
      out += lines.map((l) => `${l}\x1b[K`).join("\r\n");
      out += "\x1b[J";
      out += cursor ? `\x1b[${cursor.row + 1};${cursor.col + 1}H\x1b[?25h` : "\x1b[?25l";
      write(out);
    }

    /** Draw once per tick, however many changes came. */
    function schedule() {
      if (pending) return;
      pending = true;
      setImmediate(() => {
        pending = false;
        draw();
      });
    }

    async function finish() {
      if (closed) return;
      closed = true;
      input.off("keypress", onKey);
      output.off("resize", onResize);
      process.off("exit", onExit);
      process.off("SIGTERM", onSignal);
      process.off("SIGHUP", onSignal);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      write(RESTORE);
      await app.session.terminate();
      resolve();
    }

    function onKey(str, key) {
      // a bracketed paste: everything between ESC [200~ and ESC [201~ is text
      if (key && key.name === "paste-start") {
        pasting = "";
        return;
      }
      if (pasting !== null) {
        if (key && key.name === "paste-end") {
          const text = pasting;
          pasting = null;
          app.paste(text).then(schedule, schedule);
          return;
        }
        pasting += str ?? (key && key.sequence) ?? "";
        return;
      }
      const k = keyName(str, key);
      if (!k) return;
      const p = app.key(k);
      if (app.quitting) {
        finish();
        return;
      }
      schedule();
      p.then(schedule, (e) => {
        app.session.log.push(String((e && e.message) || e));
        schedule();
      });
    }

    function onResize() {
      app.resize(output.columns || 80, output.rows || 24);
      schedule();
    }

    readline.emitKeypressEvents(input);
    if (input.isTTY) input.setRawMode(true);
    input.on("keypress", onKey);
    output.on("resize", onResize);
    process.on("exit", onExit);
    process.on("SIGTERM", onSignal);
    process.on("SIGHUP", onSignal);
    input.resume();
    write("\x1b[?1049h\x1b[?2004h\x1b[H\x1b[2J");
    app.resize(output.columns || app.width, output.rows || app.height);
    app.redraw = schedule;
    draw();
  });
}
