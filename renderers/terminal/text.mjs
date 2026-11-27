/*
 * Terminal text: display width by grapheme cluster (wide East Asian
 * characters and emoji take two columns, combining marks none), sanitising (nothing a backend sends may
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
// (East Asian Wide and Fullwidth; the emoji among them are decided by their
// Emoji_Presentation property, clusterWidth)
const ZERO = [[0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a], [0x064b, 0x065f], [0x0e31, 0x0e31], [0x0e34, 0x0e3a],
  [0x1160, 0x11ff], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x206f], [0x20d0, 0x20ff],
  [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0xfeff, 0xfeff], [0xe0000, 0xe0fff]];
const WIDE = [[0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x2614, 0x2615],
  [0x2648, 0x2653], [0x26aa, 0x26ab], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
  [0xa960, 0xa97f], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
  [0x16fe0, 0x16fe4], [0x16ff0, 0x16ff1], [0x17000, 0x18cd5], [0x18d00, 0x18d08], [0x1aff0, 0x1b2fb], [0x1f200, 0x1f202],
  [0x1f210, 0x1f23b], [0x1f240, 0x1f248], [0x1f250, 0x1f251], [0x1f260, 0x1f265], [0x20000, 0x2fffd], [0x30000, 0x3fffd]];

const inRanges = (cp, ranges) => {
  for (const [a, b] of ranges) {
    if (cp < a) return false;
    if (cp <= b) return true;
  }
  return false;
};

/** The columns one code point takes on its own. */
export function charWidth(cp) {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (inRanges(cp, ZERO)) return 0;
  return inRanges(cp, WIDE) ? 2 : 1;
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const SEGMENTER = typeof Intl === "object" && Intl.Segmenter ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;
const EMOJI = /\p{Emoji_Presentation}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const KEYCAP_BASE = /^[#*0-9]$/;

/** A string split into what a terminal draws as one character: grapheme
 *  clusters (a letter with its combining marks, an emoji with its modifiers
 *  and ZWJ partners, a flag). */
export function graphemes(s) {
  const t = String(s);
  if (PRINTABLE_ASCII.test(t)) return t.split("");
  if (!SEGMENTER) return [...t];
  return Array.from(SEGMENTER.segment(t), (x) => x.segment);
}

/**
 * The columns one grapheme cluster takes: its first code point decides
 * (a combining mark or a control none, East Asian Wide and Fullwidth two),
 * an emoji takes two - one with emoji presentation (by default or asked for
 * with VS16), a ZWJ sequence of pictographs once, a flag - and VS15 asks
 * for the one-column text presentation.
 */
export function clusterWidth(g) {
  const cp = g.codePointAt(0);
  if (cp === undefined) return 0;
  const base = charWidth(cp);
  if (base === 0) return 0;
  const first = String.fromCodePoint(cp);
  const pict = PICTOGRAPHIC.test(first);
  if (g.length > first.length) {
    if (g.includes("\ufe0f") && (pict || KEYCAP_BASE.test(first))) return 2;
    if (g.includes("\ufe0e") && pict) return 1;
    if (pict && g.includes("\u200d")) return 2;
  }
  return EMOJI.test(first) ? 2 : base;
}

/** The columns a string takes on screen. */
export function strWidth(s) {
  const t = String(s);
  if (PRINTABLE_ASCII.test(t)) return t.length;
  let w = 0;
  for (const g of graphemes(t)) w += clusterWidth(g);
  return w;
}

// what clean() strips: the bidirectional embeddings, overrides and isolates
// (U+202A-U+202E, U+2066-U+2069) - they would reorder the text around them
const BIDI = /[\u202a-\u202e\u2066-\u2069]/g;
// what the sink drops: every C0 and C1 control, DEL and the bidi controls
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Text from the backend made safe for a terminal: every C0 and C1 control
 * character (ESC, BEL, CSI, ...) and DEL becomes U+FFFD, the bidi controls
 * are stripped, a tab becomes four spaces, CR LF / CR a line feed - so no
 * view, model value or error body can move the cursor, retitle the window,
 * write to the clipboard or reorder what is shown. `keepNewlines` false
 * turns line feeds into spaces too.
 */
export function clean(s, { keepNewlines = true } = {}) {
  const t = String(s ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(BIDI, "");
  const out = t.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "\ufffd");
  return keepNewlines ? out : out.replace(/\n/g, " ");
}

/** The last line of defence before the terminal: a segment's text without
 *  any control character (they take no column, so the layout stays). Every
 *  text of the backend is clean()ed where it is read; this catches a path
 *  that forgot to. */
export const safe = (s) => String(s).replace(UNSAFE, "");

/** Cut a string to `w` columns. */
export function sliceWidth(s, w) {
  let out = "";
  let used = 0;
  for (const g of graphemes(s)) {
    const cw = clusterWidth(g);
    if (used + cw > w) break;
    out += g;
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
        const head = sliceWidth(rest, width) || graphemes(rest)[0];
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
    // the line goes on past this segment: the ellipsis is shown even when
    // the segment itself would fit
    const room = Math.max(0, w - used);
    out.push({ ...s, text: room >= e ? sliceWidth(s.text, room - e) + glyphs.ellipsis : sliceWidth(s.text, room) });
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
 *  `color` is on, else the plain text - every segment through safe(), so
 *  the only escape sequences are these SGR styles. */
export function lineAnsi(line, color) {
  if (!color) return safe(lineText(line)).replace(/ +$/, "");
  // neighbouring segments of one style share one SGR sequence
  const runs = [];
  for (const s of line) {
    const text = safe(s.text ?? "");
    if (!text) continue;
    const last = runs[runs.length - 1];
    if (last && last.style === (s.style || "")) last.text += text;
    else runs.push({ text, style: s.style || "" });
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
