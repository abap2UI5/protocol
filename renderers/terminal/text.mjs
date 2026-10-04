/*
 * Terminal text: display width (wide East Asian characters take two
 * columns, combining marks none), sanitising (nothing a backend sends may
 * reach the terminal as a control sequence), wrapping, truncation with an
 * ellipsis, the glyph sets and the ANSI styles. Pure, no I/O.
 *
 * A line is an array of segments { text, style?, key? }: `style` a space
 * separated list of STYLE names, `key` the widget the segment belongs to.
 */

/** SGR codes of the style names a segment may carry. */
export const STYLE = {
  bold: 1, dim: 2, italic: 3, underline: 4, reverse: 7,
  red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, gray: 90,
};

/** The two glyph sets: ASCII (logs, `--print`, screen readers, the tests)
 *  and Unicode box drawing (a UTF-8 terminal). */
export const GLYPHS = {
  ascii: { h: "-", v: "|", tl: "+", tr: "+", bl: "+", br: "+", ellipsis: "...", rule: "-", heavy: "=", fill: "_", bar: "#", barEmpty: "-" },
  unicode: { h: "\u2500", v: "\u2502", tl: "\u250c", tr: "\u2510", bl: "\u2514", br: "\u2518", ellipsis: "\u2026", rule: "\u2500", heavy: "\u2550", fill: "_", bar: "\u2588", barEmpty: "\u2591" },
};

// [from, to] code point ranges of zero-width and of double-width characters
const ZERO = [[0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a], [0x064b, 0x065f], [0x0e31, 0x0e31], [0x0e34, 0x0e3a],
  [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x20d0, 0x20ff], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0xfeff, 0xfeff]];
const WIDE = [[0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x2614, 0x2615], [0x2648, 0x2653], [0x26aa, 0x26ab],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd]];

const inRanges = (cp, ranges) => {
  for (const [a, b] of ranges) {
    if (cp < a) return false;
    if (cp <= b) return true;
  }
  return false;
};

/** The columns one code point takes. */
export function charWidth(cp) {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (inRanges(cp, ZERO)) return 0;
  return inRanges(cp, WIDE) ? 2 : 1;
}

/** The columns a string takes on screen. */
export function strWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += charWidth(ch.codePointAt(0));
  return w;
}

/**
 * Text from the backend made safe for a terminal: every C0 and C1 control
 * character (ESC, BEL, CSI, ...) and DEL becomes U+FFFD, a tab four spaces,
 * CR LF / CR a line feed - so no view, model value or error body can move
 * the cursor, retitle the window or write to the clipboard. `keepNewlines`
 * false turns line feeds into spaces too.
 */
export function clean(s, { keepNewlines = true } = {}) {
  const t = String(s ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  const out = t.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "\ufffd");
  return keepNewlines ? out : out.replace(/\n/g, " ");
}

/** Cut a string to `w` columns. */
export function sliceWidth(s, w) {
  let out = "";
  let used = 0;
  for (const ch of String(s)) {
    const cw = charWidth(ch.codePointAt(0));
    if (used + cw > w) break;
    out += ch;
    used += cw;
  }
  return out;
}

/** A string of at most `w` columns, cut with the ellipsis when it is longer. */
export function truncate(s, w, glyphs = GLYPHS.ascii) {
  if (w <= 0) return "";
  if (strWidth(s) <= w) return String(s);
  const e = glyphs.ellipsis;
  if (w <= strWidth(e)) return sliceWidth(s, w);
  return sliceWidth(s, w - strWidth(e)) + e;
}

/** Pad a string with spaces to `w` columns (no cut). */
export const pad = (s, w) => String(s) + " ".repeat(Math.max(0, w - strWidth(s)));

/** Wrap text to lines of at most `w` columns: at spaces, a word longer
 *  than a line is broken. Line feeds are kept. */
export function wrap(s, w) {
  const width = Math.max(1, w);
  const out = [];
  for (const para of String(s).split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      if (word === "") continue;
      let rest = word;
      const candidate = line ? `${line} ${rest}` : rest;
      if (strWidth(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      line = "";
      while (strWidth(rest) > width) {
        const head = sliceWidth(rest, width) || [...rest][0];
        out.push(head);
        rest = rest.slice(head.length);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

// --------------------------------------------------------------- lines ----

export const lineWidth = (line) => line.reduce((n, s) => n + strWidth(s.text), 0);

/** A line cut to `w` columns (the last segment gets the ellipsis). */
export function truncateLine(line, w, glyphs = GLYPHS.ascii) {
  if (lineWidth(line) <= w) return line;
  const out = [];
  let used = 0;
  const e = strWidth(glyphs.ellipsis);
  for (const s of line) {
    const sw = strWidth(s.text);
    if (used + sw <= w - e) {
      out.push(s);
      used += sw;
      continue;
    }
    out.push({ ...s, text: truncate(s.text, w - used, glyphs) });
    break;
  }
  return out;
}

/** A line padded with spaces to `w` columns. */
export function padLine(line, w) {
  const n = w - lineWidth(line);
  return n > 0 ? [...line, { text: " ".repeat(n) }] : line;
}

/** The plain text of a line. */
export const lineText = (line) => line.map((s) => s.text).join("");

/** A line as ANSI text: styled segments wrapped in SGR sequences when
 *  `color` is on, else the plain text. */
export function lineAnsi(line, color) {
  if (!color) return lineText(line).replace(/ +$/, "");
  // neighbouring segments of one style share one SGR sequence
  const runs = [];
  for (const s of line) {
    if (!s.text) continue;
    const last = runs[runs.length - 1];
    if (last && last.style === (s.style || "")) last.text += s.text;
    else runs.push({ text: s.text, style: s.style || "" });
  }
  let out = "";
  for (const r of runs) {
    const codes = r.style.split(/\s+/).map((n) => STYLE[n]).filter(Boolean);
    out += codes.length ? `\x1b[${codes.join(";")}m${r.text}\x1b[0m` : r.text;
  }
  return out;
}

/**
 * Whether to color: off with `--no-color` or a non-empty NO_COLOR
 * (https://no-color.org), on with `--color` or FORCE_COLOR (not "0"), else
 * when the stream is a TTY and TERM is not "dumb".
 */
export function colorWanted({ flag, env = process.env, stream } = {}) {
  if (flag === false) return false;
  if (flag === true) return true;
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "") return env.FORCE_COLOR !== "0" && env.FORCE_COLOR !== "false";
  return Boolean(stream && stream.isTTY) && env.TERM !== "dumb";
}

/** Whether the terminal takes UTF-8 box drawing (the locale says UTF-8). */
export function unicodeWanted(env = process.env) {
  return /utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || "");
}
