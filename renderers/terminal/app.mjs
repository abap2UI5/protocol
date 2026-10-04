/*
 * The terminal renderer's state machine: the session's state on screen,
 * the focus, the field being edited, the pick list - and the keys. No TTY:
 * tty.mjs feeds it keys and writes its frames; the conformance adapter and
 * the tests drive it the same way ("type", "press") and read its screen as
 * text.
 *
 *   const app = createTerminalApp({ session, width: 80, height: 24 });
 *   await app.key("tab"); await app.type("Ada"); await app.key("enter");
 *   app.frame()   // { lines, cursor } - the screen: header, body, status line
 *   app.print()   // the whole screen as text, overlays below the page (--print)
 *
 * Keys (README.md#keys): Tab / Shift+Tab move the focus, Up/Down move it to
 * the widget above / below (step a StepInput, move in a TextArea), Left /
 * Right move the cursor of a field and pick in a pick list, Enter fires the
 * focused action (submits a field that has a submit event, opens a pick
 * list), Space toggles, Esc closes the pick list or a popover, Alt+Left /
 * Ctrl+B go back, PageUp / PageDown scroll, F1 shows the keys, Ctrl+R
 * restarts the app, Ctrl+C quits.
 *
 * An edit is the UI5 Input's: it is written into the model when it is
 * committed - the focus leaves the field, Enter, an action fires - and only
 * when the value changed; the field's change event fires then, once. The
 * edit then travels with the next event as the model delta.
 */
import { getAt } from "../../conformance/frontend/adapters/vendor/mcp-server/snapshot.mjs";
import { coerce } from "../common/request.mjs";
import { renderScreen } from "./render.mjs";
import { layoutBlocks, frame as drawFrame } from "./layout.mjs";
import { GLYPHS, lineAnsi, lineText, lineWidth, padLine, truncateLine, strWidth, truncate, sliceWidth } from "./text.mjs";

const seg = (text, style, extra) => ({ text, ...(style ? { style } : {}), ...(extra || {}) });

/** The columns [from, to) of a line, padded with spaces. */
function sliceLine(line, from, to) {
  const out = [];
  let col = 0;
  for (const s of line) {
    for (const ch of s.text) {
      const w = strWidth(ch);
      if (col >= from && col + w <= to) {
        const last = out[out.length - 1];
        if (last && last.style === s.style && last.key === s.key && !last.cursor) last.text += ch;
        else out.push({ ...s, text: ch });
      }
      col += w;
    }
    if (s.cursor && col >= from && col < to) out.push(s);
  }
  return padLine(out, to - from);
}

const paste = (line, x, over, width) => [...sliceLine(line, 0, x), ...over, ...sliceLine(line, x + lineWidth(over), width)];

const KEYS_HELP = [
  ["Tab / Shift+Tab", "next / previous field or action"],
  ["Up / Down", "the field above / below; step a number; lines of a text area"],
  ["Left / Right", "move in a field; pick in a pick list"],
  ["Enter", "press the action; submit the field; open a pick list"],
  ["Space", "toggle a check box, switch or row; press a button"],
  ["Esc", "close the pick list, this help or a popover"],
  ["Alt+Left / Ctrl+B", "back (history, else the page's back button)"],
  ["Alt+Right", "forward"],
  ["PageUp / PageDown", "scroll"],
  ["F4", "value help of the field"],
  ["Ctrl+U", "clear the field"],
  ["Ctrl+R", "restart the app"],
  ["Ctrl+C / Ctrl+Q", "quit"],
];

export function createTerminalApp({ session, width = 80, height = 24, color = false, unicode = false } = {}) {
  if (!session) throw new Error("createTerminalApp: session is required");
  // with color a field is an underlined stretch; without, underscores show it
  const glyphs = { ...(unicode ? GLYPHS.unicode : GLYPHS.ascii), ...(color ? { fill: " " } : {}) };
  const ui = {
    width, height,
    focus: null,
    edit: null,          // { key, buffer, cursor, original }
    picker: null,        // { key, index, selected: Set }
    help: false,
    scroll: 0,
    follow: true,        // the next frame scrolls the focus into view
    lastFocus: {},       // slot -> key, restored when an overlay closes
    local: new Map(),    // values of fields bound to nothing
    quit: false,
    seen: -1,            // the roundtrip whose notices a key press dismissed
  };

  const env = () => ({ glyphs, markers: !color, focus: ui.focus, edit: ui.edit });

  // ---------------------------------------------------------- screen ----

  /** The screen for the session's state, the focus reconciled with it. */
  function view() {
    const screen = renderScreen(session.state, { messages: session.messages, error: session.error });
    for (const w of screen.widgets) if (!w.path && ui.local.has(w.key)) w.value = ui.local.get(w.key);
    const ws = screen.widgets;
    const request = session.takeFocusRequest();
    const target = request && ws.find((w) => w.viewId === request);
    if (target) setFocus(target.key);
    if (!ws.some((w) => w.key === ui.focus)) {
      const top = ws[0] ? ws[0].slot : null;
      const back = top && ws.find((w) => w.key === ui.lastFocus[top]);
      // the first input field, else the first action - the page's back
      // button only when it is all there is
      const first = ws.find((w) => w.slot === top && w.kind === "input") || ws.find((w) => w.slot === top && !w.nav) || ws[0];
      setFocus(back ? back.key : (first ? first.key : null));
    }
    const scrollTo = session.takeScrollRequest();
    if (scrollTo) ui.scrollTo = scrollTo;
    const f = ws.find((w) => w.key === ui.focus);
    if (f && f.kind === "input") {
      const value = String(f.value ?? "");
      if (!ui.edit || ui.edit.key !== f.key) ui.edit = { key: f.key, buffer: value, cursor: value.length, original: value };
      else if (ui.edit.buffer === ui.edit.original && ui.edit.original !== value) ui.edit = { key: f.key, buffer: value, cursor: value.length, original: value };
    } else if (ui.edit && (!f || ui.edit.key !== f.key)) {
      ui.edit = null;
    }
    return screen;
  }

  function setFocus(key) {
    if (key === ui.focus) return;
    ui.focus = key;
    ui.follow = true;
    if (key) ui.lastFocus[key.split("|")[0]] = key;
  }

  const widgetByKey = (key) => view().widgets.find((w) => w.key === key) || null;
  const focused = () => {
    const ws = view().widgets;
    return ws.find((w) => w.key === ui.focus) || null;
  };

  function layerLines(layer, w, e = env()) {
    return layoutBlocks(layer.blocks, w, e);
  }

  /** An overlay drawn in its frame, as wide as its content (float) or the
   *  screen (stack). */
  function overlayLines(layer, w, { fit, e = env() }) {
    const style = layer.slot === "BOX" ? ({ error: "red", warning: "yellow", success: "green" })[layer.kind] || "bold" : undefined;
    let boxW = w;
    if (fit) {
      const natural = Math.max(strWidth(layer.title || "") + 6, ...layerLines(layer, Math.max(10, w - 8), e).map(lineWidth));
      boxW = Math.min(w, Math.max(Math.min(w, 40), natural + 4));
    }
    return drawFrame(layer.title, layerLines(layer, boxW - 4, e), boxW, e, style);
  }

  /** The whole screen as lines: the page, then every overlay below it -
   *  without a focus (nobody types into a printout). */
  function stackLines(w, screen = view()) {
    const e = { ...env(), focus: null, edit: null };
    const out = [];
    for (const layer of screen.layers) {
      if (layer.kind === "overlay") {
        if (out.length) out.push([]);
        out.push(...overlayLines(layer, w, { fit: false, e }));
      } else {
        out.push(...layerLines(layer, w, e));
      }
    }
    return out;
  }

  const keyLine = (lines, key) => lines.findIndex((l) => l.some((s) => s.key === key));

  /** The status line: busy, the notices of the last roundtrip (until the
   *  next key), the controls not rendered, then the keys of the focus. */
  function statusText(screen) {
    const parts = [];
    if (session.busy) parts.push("working...");
    if (session.roundtrips > ui.seen) parts.push(...session.notices);
    const missing = screen.unsupported.filter((u) => /placeholder/.test(u.reason));
    if (missing.length) parts.push(`not rendered: ${[...new Set(missing.map((u) => u.control))].join(", ")}`);
    const f = screen.widgets.find((w) => w.key === ui.focus);
    const help = [];
    if (ui.picker) help.push("Up/Down move", ...(focusedPickerMulti(screen) ? ["Space tick"] : []), "Enter pick", "Esc cancel");
    else if (f) {
      if (f.kind === "input") help.push("type to edit", ...(f.submit ? ["Enter submit"] : []), ...(f.valueHelp ? ["F4 help"] : []), ...(f.step ? ["Up/Down step"] : []));
      else if (f.kind === "toggle") help.push("Space toggle");
      else if (f.kind === "choice") help.push("Left/Right pick", ...(f.variant !== "segmented" ? ["Enter list"] : []));
      else help.push("Enter press");
      help.push("Tab next");
    }
    help.push("F1 keys", "Ctrl+C quit");
    return [...parts, help.join("  ")].join(" | ");
  }

  const focusedPickerMulti = (screen) => {
    const w = screen.widgets.find((x) => x.key === (ui.picker && ui.picker.key));
    return Boolean(w && w.multi);
  };

  function pickerLines(screen, w) {
    const f = screen.widgets.find((x) => x.key === ui.picker.key);
    if (!f) return null;
    const lines = f.options.map((o, i) => {
      const on = ui.picker.index === i;
      const mark = f.multi ? `[${ui.picker.selected.has(o.key) ? "x" : " "}] ` : "";
      return [seg(`${on && !color ? ">" : " "}${mark}${o.text}`, on ? "reverse" : undefined)];
    });
    const natural = Math.max(16, ...lines.map(lineWidth)) + 4;
    return drawFrame(f.multi ? "Pick (Space ticks)" : "Pick", lines, Math.min(w, natural), env(), "bold");
  }

  function helpLines(w) {
    const kw = Math.max(...KEYS_HELP.map(([k]) => k.length));
    const lines = KEYS_HELP.map(([k, d]) => [seg(k.padEnd(kw + 2), "bold"), seg(d)]);
    return drawFrame("Keys", lines, Math.min(w, kw + 2 + Math.max(...KEYS_HELP.map(([, d]) => d.length)) + 4), env(), "bold");
  }

  /**
   * The screen of a terminal `height` lines high: a header (the app, the
   * title, the hash), the page scrolled to the focus with the overlays above
   * it, and the status line with the keys. Resolves { lines: [string],
   * cursor: { row, col } | null } - lines with ANSI styles when color is on.
   */
  function frame() {
    const screen = view();
    const W = ui.width;
    const bodyH = Math.max(1, ui.height - 2);
    const page = screen.layers.find((l) => l.kind !== "overlay");
    const pageLines = page ? layerLines(page, W) : [];
    if (ui.scrollTo) {
      const at = pageLines.findIndex((l) => l.some((s) => s.key && s.key.endsWith(`|${ui.scrollTo}`)));
      if (at >= 0) ui.scroll = at;
      ui.scrollTo = null;
      ui.follow = false;
    }
    if (ui.follow) {
      const at = keyLine(pageLines, ui.focus);
      if (at >= 0) {
        if (at < ui.scroll) ui.scroll = at;
        if (at >= ui.scroll + bodyH) ui.scroll = at - bodyH + 1;
      }
      ui.follow = false;
    }
    ui.scroll = Math.max(0, Math.min(ui.scroll, Math.max(0, pageLines.length - bodyH)));
    const modal = screen.layers.some((l) => l.kind === "overlay" && l.slot !== "POPOVER");
    let body = [];
    for (let i = 0; i < bodyH; i += 1) {
      const l = pageLines[ui.scroll + i] || [];
      body.push(modal && color ? l.map((s) => ({ ...s, style: "dim" })) : l);
    }
    const place = (frameLines) => {
      // a column of space either side keeps the page's text off the frame
      const box = frameLines.map((l) => [seg(" "), ...l, seg(" ")]);
      const boxW = Math.max(0, ...box.map(lineWidth));
      const x = Math.max(0, Math.floor((W - boxW) / 2));
      let shown = box;
      if (box.length > bodyH) {
        const at = Math.max(0, keyLine(box, ui.focus));
        const top = Math.max(0, Math.min(at - Math.floor(bodyH / 2), box.length - bodyH));
        shown = box.slice(top, top + bodyH);
      }
      const y = Math.max(0, Math.floor((bodyH - shown.length) / 2));
      body = body.map((l, i) => (i >= y && i < y + shown.length ? paste(l, x, shown[i - y], W) : l));
    };
    for (const layer of screen.layers.filter((l) => l.kind === "overlay")) place(overlayLines(layer, W - 4, { fit: true }));
    if (ui.picker) {
      const p = pickerLines(screen, W - 8);
      if (p) place(p);
    }
    if (ui.help) place(helpLines(W - 4));
    const title = session.title || screen.title || session.state.app || "";
    const right = session.hash ? ` ${session.hash}` : "";
    const left = ` abap2UI5${title ? ` - ${title}` : ""}`;
    const headText = `${truncate(left, Math.max(1, W - strWidth(right)), glyphs)}`;
    const header = padLine([seg(headText, "reverse bold"), seg(" ".repeat(Math.max(0, W - strWidth(headText) - strWidth(right))), "reverse"), seg(sliceWidth(right, Math.max(0, W - strWidth(headText))), "reverse")], W);
    const status = [seg(truncate(statusText(screen), W, glyphs), "reverse")];
    const all = [header, ...body.map((l) => truncateLine(l, W, glyphs)), padLine(status, W)];
    let cursor = null;
    all.forEach((l, row) => {
      let col = 0;
      for (const s of l) {
        if (s.cursor && !cursor) cursor = { row, col };
        col += strWidth(s.text);
      }
    });
    return { lines: all.map((l) => lineAnsi(l, color)), cursor };
  }

  // ----------------------------------------------------------- edits ----

  /** The value of a field's text in the type the model holds there. */
  function typed(w, text) {
    if (!w.path) return text;
    const m = session.state.models[w.modelKey];
    return coerce(text, getAt((m && m.data) || {}, w.path));
  }

  /** Write a value into the model (or the field's own store when it is bound
   *  to nothing). */
  function write(w, value) {
    if (w.path) session.edit(w.slot, w.path, value);
    else ui.local.set(w.key, value);
  }

  /** Fire event `name` of widget `key`, its data built when it leaves the
   *  queue - from the widget as it is on screen then. */
  function fireEvent(key, name, params, which) {
    return session.fire(() => {
      const w = widgetByKey(key);
      if (!w) return null;
      const target = which === "change" ? (w.changeNode || w.node) : which === "press" ? ((w.press && w.press.target) || w.node) : w.node;
      return w.eventData(name, params, target);
    });
  }

  function fireChange(w, value) {
    const names = [].concat(w.change || []);
    let last = Promise.resolve();
    for (const n of names) last = fireEvent(w.key, n, w.params ? w.params(value) : undefined, "change");
    return last;
  }

  /** Commit the field being edited: into the model when it changed, and its
   *  change event. Resolves when that event (if any) is done. */
  function commit() {
    const e = ui.edit;
    if (!e || e.buffer === e.original) return Promise.resolve();
    const w = widgetByKey(e.key);
    e.original = e.buffer;
    if (!w) return Promise.resolve();
    write(w, typed(w, e.buffer));
    return fireChange(w, e.buffer);
  }

  function press(w) {
    const committed = commit();
    if (w.box !== undefined) return Promise.all([committed, session.fire({ box: w.box })]);
    if (!w.press) return committed;
    return Promise.all([committed, fireEvent(w.key, w.press.name, undefined, "press")]);
  }

  function toggle(w) {
    const v = !w.value;
    write(w, v);
    return fireChange(w, v);
  }

  function pick(w, key) {
    if (JSON.stringify(key) === JSON.stringify(w.value)) return Promise.resolve();
    write(w, key);
    return fireChange(w, key);
  }

  function stepChoice(w, dir) {
    const n = w.options.length;
    if (!n || w.multi) return Promise.resolve();
    const i = w.options.findIndex((o) => o.key === w.value);
    const next = w.options[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + n) % n];
    return pick(w, next.key);
  }

  function moveFocus(dir) {
    const ws = view().widgets;
    if (!ws.length) return Promise.resolve();
    const committed = commit();
    const i = ws.findIndex((w) => w.key === ui.focus);
    setFocus(ws[(i + dir + ws.length) % ws.length].key);
    view();
    return committed;
  }

  /** The widget above / below the focused one in its layer: the nearest
   *  line, then the nearest column. */
  function moveSpatial(dir) {
    const screen = view();
    const f = screen.widgets.find((w) => w.key === ui.focus);
    if (!f) {
      ui.scroll = Math.max(0, ui.scroll + dir);
      return Promise.resolve();
    }
    const layer = screen.layers.find((l) => (l.slot === "BOX" ? "BOX" : l.slot) === f.slot) || screen.layers[0];
    const lines = layer.kind === "overlay" ? overlayLines(layer, ui.width - 4, { fit: true }) : layerLines(layer, ui.width);
    const pos = new Map();
    lines.forEach((l, row) => {
      let col = 0;
      for (const s of l) {
        if (s.key && !pos.has(s.key)) pos.set(s.key, { row, col });
        col += strWidth(s.text);
      }
    });
    const cur = pos.get(f.key);
    if (!cur) return moveFocus(dir);
    let best = null;
    for (const w of screen.widgets) {
      const p = pos.get(w.key);
      if (!p || w.key === f.key) continue;
      if (dir < 0 ? p.row >= cur.row : p.row <= cur.row) continue;
      const score = [Math.abs(p.row - cur.row), Math.abs(p.col - cur.col)];
      if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { w, score };
    }
    if (!best) {
      ui.scroll = Math.max(0, ui.scroll + dir);
      return Promise.resolve();
    }
    const committed = commit();
    setFocus(best.w.key);
    view();
    return committed;
  }

  // ------------------------------------------------------------ keys ----

  function editKey(name, ch) {
    const e = ui.edit;
    const chars = [...e.buffer];
    const c = [...e.buffer.slice(0, e.cursor)].length;
    const set = (arr, cur) => {
      e.buffer = arr.join("");
      e.cursor = arr.slice(0, cur).join("").length;
    };
    switch (name) {
      case "left": set(chars, Math.max(0, c - 1)); return true;
      case "right": set(chars, Math.min(chars.length, c + 1)); return true;
      case "home": case "ctrl-a": set(chars, 0); return true;
      case "end": case "ctrl-e": set(chars, chars.length); return true;
      case "backspace": if (c > 0) { chars.splice(c - 1, 1); set(chars, c - 1); } return true;
      case "delete": if (c < chars.length) { chars.splice(c, 1); set(chars, c); } return true;
      case "ctrl-u": set([], 0); return true;
      case "char": {
        const add = [...ch];
        chars.splice(c, 0, ...add);
        set(chars, c + add.length);
        return true;
      }
      default: return false;
    }
  }

  /** Up/Down in a text area: the cursor to the line above / below. */
  function textAreaLine(dir) {
    const e = ui.edit;
    const before = e.buffer.slice(0, e.cursor);
    const lines = e.buffer.split("\n");
    const row = before.split("\n").length - 1;
    const col = before.split("\n").pop().length;
    const to = row + dir;
    if (to < 0 || to >= lines.length) return false;
    const start = lines.slice(0, to).reduce((n, l) => n + l.length + 1, 0);
    e.cursor = start + Math.min(col, lines[to].length);
    return true;
  }

  function stepNumber(w, dir) {
    const e = ui.edit;
    const s = w.step || {};
    let v = Number(e.buffer) || 0;
    v += dir * (s.step || 1);
    if (s.min !== undefined && v < s.min) v = s.min;
    if (s.max !== undefined && v > s.max) v = s.max;
    const r = Math.round(v * 1e9) / 1e9;
    e.buffer = String(r);
    e.cursor = e.buffer.length;
  }

  function pickerKey(name) {
    const screen = view();
    const w = screen.widgets.find((x) => x.key === ui.picker.key);
    if (!w) {
      ui.picker = null;
      return Promise.resolve();
    }
    const n = w.options.length;
    switch (name) {
      case "up": ui.picker.index = (ui.picker.index - 1 + n) % n; break;
      case "down": ui.picker.index = (ui.picker.index + 1) % n; break;
      case "home": ui.picker.index = 0; break;
      case "end": ui.picker.index = n - 1; break;
      case "space":
        if (w.multi) {
          const k = w.options[ui.picker.index].key;
          if (ui.picker.selected.has(k)) ui.picker.selected.delete(k);
          else ui.picker.selected.add(k);
        }
        break;
      case "enter": {
        const p = ui.picker;
        ui.picker = null;
        if (w.multi) return pick(w, w.options.map((o) => o.key).filter((k) => p.selected.has(k)));
        return pick(w, w.options[p.index].key);
      }
      case "escape": ui.picker = null; break;
      default:
    }
    return Promise.resolve();
  }

  async function back() {
    await commit();
    if (await session.back()) return;
    const nav = view().widgets.find((w) => w.nav);
    if (nav) await press(nav);
  }

  /**
   * One key: a name ("tab", "shift-tab", "enter", "space", "escape", "up",
   * "down", "left", "right", "home", "end", "pageup", "pagedown",
   * "backspace", "delete", "f1", "f4", "ctrl-b", "ctrl-c", "ctrl-q",
   * "ctrl-r", "ctrl-u", "alt-left", "alt-right") or { ch } for a printable
   * character. Resolves when what it fired is done (the roundtrip included).
   */
  function key(k) {
    const name = typeof k === "string" ? k : "char";
    const ch = typeof k === "string" ? (k === "space" ? " " : null) : k.ch;
    ui.seen = session.roundtrips;
    if (name === "ctrl-c" || name === "ctrl-q") {
      ui.quit = true;
      return Promise.resolve();
    }
    if (ui.help) {
      if (name === "escape" || name === "f1" || name === "enter") ui.help = false;
      return Promise.resolve();
    }
    if (name === "f1") {
      ui.help = true;
      return Promise.resolve();
    }
    if (ui.picker) return pickerKey(name);
    const screen = view();
    const w = screen.widgets.find((x) => x.key === ui.focus);
    switch (name) {
      case "tab": return moveFocus(1);
      case "shift-tab": return moveFocus(-1);
      case "pageup": ui.scroll = Math.max(0, ui.scroll - (ui.height - 3)); return Promise.resolve();
      case "pagedown": ui.scroll += ui.height - 3; return Promise.resolve();
      case "alt-left": case "ctrl-b": return back();
      case "alt-right": return commit().then(() => session.forward());
      case "ctrl-r": return commit().then(() => session.reload());
      case "escape":
        if (session.state.slots.POPOVER) return commit().then(() => session.fire({ client: ["VIEW_SLOTS", "destroy", "POPOVER"], slot: "POPOVER" }));
        return Promise.resolve();
      default:
    }
    if (!w) {
      if (name === "up" || name === "down") ui.scroll = Math.max(0, ui.scroll + (name === "up" ? -1 : 1));
      return Promise.resolve();
    }
    if (w.kind === "input") {
      if (name === "enter" && w.multiline) return Promise.resolve(editKey("char", "\n"));
      if (name === "enter") return commit().then(() => (w.submit ? fireEvent(w.key, w.submit, w.params ? w.params(ui.edit ? ui.edit.buffer : String(w.value ?? "")) : undefined) : undefined));
      if (name === "f4" && w.valueHelp) return commit().then(() => fireEvent(w.key, w.valueHelp));
      if ((name === "up" || name === "down") && w.step) {
        stepNumber(w, name === "up" ? 1 : -1);
        return Promise.resolve();
      }
      if ((name === "up" || name === "down") && w.multiline && textAreaLine(name === "up" ? -1 : 1)) return Promise.resolve();
      if (name === "space") return Promise.resolve(editKey("char", " "));
      if (name === "char" && w.maxLength && [...ui.edit.buffer].length >= w.maxLength) return Promise.resolve();
      if (editKey(name, ch)) return Promise.resolve();
    }
    switch (name) {
      case "up": return moveSpatial(-1);
      case "down": return moveSpatial(1);
      case "left":
      case "right":
        if (w.kind === "choice") return stepChoice(w, name === "left" ? -1 : 1);
        return moveFocus(name === "left" ? -1 : 1);
      case "enter":
        if (w.kind === "toggle") return toggle(w);
        if (w.kind === "choice") {
          if (w.variant === "segmented") return stepChoice(w, 1);
          const i = w.multi ? 0 : Math.max(0, w.options.findIndex((o) => o.key === w.value));
          ui.picker = { key: w.key, index: i, selected: new Set(w.multi ? w.value : []) };
          return Promise.resolve();
        }
        return press(w);
      case "space":
        if (w.kind === "toggle") return toggle(w);
        if (w.kind === "choice") return stepChoice(w, 1);
        return press(w);
      case "char":
        if (w.kind === "choice" && ch) {
          // type-ahead: the next option starting with the character
          const n = w.options.length;
          const i = w.options.findIndex((o) => o.key === w.value);
          for (let d = 1; d <= n; d += 1) {
            const o = w.options[(i + d + n) % n];
            if (o.text.toLowerCase().startsWith(ch.toLowerCase())) return pick(w, o.key);
          }
        }
        return Promise.resolve();
      default:
        return Promise.resolve();
    }
  }

  const app = {
    session,
    /** Type text into the focused field, a key per character. */
    async type(textIn) {
      for (const ch of String(textIn)) await key(ch === "\n" ? "enter" : { ch });
    },
    key,
    frame,
    /** The whole screen as text: the page, the overlays below it - what
     *  `--print` writes. `color` adds ANSI styles. */
    print({ width: w = ui.width, color: c = color } = {}) {
      return stackLines(w).map((l) => lineAnsi(l, c)).join("\n");
    },
    /** The plain text of one layer (MAIN, POPUP, POPOVER, BOX). */
    layerText(slot) {
      const screen = view();
      const layer = screen.layers.find((l) => l.slot === slot);
      if (!layer) return "";
      const lines = layer.kind === "overlay" ? overlayLines(layer, ui.width, { fit: false }) : layerLines(layer, ui.width);
      return lines.map(lineText).join("\n");
    },
    /** The status line's text. */
    status: () => statusText(view()),
    resize(w, h) {
      ui.width = Math.max(20, w);
      ui.height = Math.max(5, h);
      ui.follow = true;
    },
    screen: () => view(),
    widgets: () => view().widgets,
    focused,
    /** Move the focus to a widget (by key). */
    focus(k) {
      setFocus(k);
      view();
    },
    get edit() { return ui.edit ? { ...ui.edit } : null; },
    get picker() { return ui.picker ? { ...ui.picker } : null; },
    get helpShown() { return ui.help; },
    get quitting() { return ui.quit; },
    get width() { return ui.width; },
    get height() { return ui.height; },
    commit,
  };
  return app;
}
