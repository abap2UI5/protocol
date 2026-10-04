/*
 * Blocks -> lines at a width. A block is what mapping.mjs renders a control
 * into; a line is an array of segments { text, style?, key?, cursor? }
 * (text.mjs). Pure, no I/O:
 *
 *   layoutBlocks(blocks, width, env) -> lines
 *   frame(title, lines, width, env) -> lines       an overlay's frame
 *
 * env: { glyphs, markers, focus, edit, fill }
 *   glyphs   text.mjs GLYPHS.ascii or .unicode
 *   markers  draw the focus as `>` `<` in place of a widget's brackets (no
 *            color to show it otherwise)
 *   focus    the key of the focused widget
 *   edit     { key, buffer, cursor } of the field being edited
 *
 * Blocks: text, heading, blank, rule, inline (a line of items: text,
 * widgets, spacers), field (a label column and its items), cols, box,
 * table, banner, bar, page.
 */
import { GLYPHS, strWidth, wrap, truncate, truncateLine, padLine, lineWidth, sliceWidth, pad, clean } from "./text.mjs";

const seg = (text, style, extra) => ({ text, ...(style ? { style } : {}), ...(extra || {}) });

// ----------------------------------------------------------- widgets ----

/** The label of an option key. */
const optionText = (w, key) => {
  const o = (w.options || []).find((x) => x.key === key);
  return o ? o.text : String(key ?? "");
};

/** The text a choice shows. */
export function choiceText(w) {
  if (w.multi) return (w.value || []).map((k) => optionText(w, k)).join(", ");
  return optionText(w, w.value);
}

/** The width a widget takes when nothing else constrains it. */
export function naturalWidth(w) {
  switch (w.kind) {
    case "button": return strWidth(w.label) + 4;
    case "link": return strWidth(w.label) + 2;
    case "toggle":
      if (w.variant === "switch") return Math.max(strWidth(w.on || "On"), strWidth(w.off || "Off")) + 2;
      return 3 + (w.label ? strWidth(w.label) + 1 : 0);
    case "choice":
      if (w.variant === "segmented") return 2 + w.options.reduce((n, o) => n + strWidth(o.text) + 4, 0) + 2 * Math.max(0, w.options.length - 1) + 2;
      return 4 + Math.max(6, strWidth(choiceText(w)), ...w.options.map((o) => strWidth(o.text)));
    case "input": {
      const v = w.multiline ? 0 : strWidth(String(w.value ?? "").replace(/\n/g, " "));
      return 2 + Math.min(30, Math.max(w.multiline ? 30 : 12, v + 1, strWidth(w.placeholder || "")));
    }
    default: return strWidth(w.label || "") + 2;
  }
}

/** The lines of one widget at `width` columns (an input takes all of it
 *  when `fill`). Most widgets are one line; a TextArea is several. */
export function widgetLines(w, width, env) {
  const g = env.glyphs || GLYPHS.ascii;
  const focused = w.focusable && env.focus === w.key;
  const open = focused && env.markers ? ">" : "[";
  const close = focused && env.markers ? "<" : "]";
  const style = focused ? "reverse" : (!w.focusable ? "dim" : undefined);
  const k = { key: w.key };
  const one = (text, st = style) => [[seg(truncate(text, width, g), st, k)]];
  switch (w.kind) {
    case "button":
      return one(`${open} ${w.label} ${close}`, style || w.style);
    case "link":
      return one(`${open}${w.label}${close}`, style || "underline blue");
    case "toggle": {
      if (w.variant === "switch") {
        const n = Math.max(strWidth(w.on || "On"), strWidth(w.off || "Off"));
        return one(`${open}${pad(w.value ? (w.on || "On") : (w.off || "Off"), n)}${close}`);
      }
      return one(`${open}${w.value ? "x" : " "}${close}${w.label ? ` ${w.label}` : ""}`);
    }
    case "choice": {
      if (w.variant === "segmented") {
        return one(`${open} ${w.options.map((o) => `(${o.key === w.value ? "o" : " "}) ${o.text}`).join("  ")} ${close}`);
      }
      const inner = Math.max(1, Math.min(width, env.fill ? width : Math.max(naturalWidth(w), w.fillTo || 0)) - 4);
      return one(`${open}${pad(truncate(choiceText(w), inner, g), inner)} v${close}`);
    }
    case "input":
      return inputLines(w, width, env, { open, close, style, k, g });
    default:
      return one(`${open}${w.label || ""}${close}`);
  }
}

function inputLines(w, width, env, { open, close, style, k, g }) {
  const editing = env.edit && env.edit.key === w.key;
  const total = Math.max(3, Math.min(width, env.fill ? width : Math.max(naturalWidth(w), w.fillTo || 0)));
  const iw = total - 2;
  // a value from the model is sanitised like every text of the backend
  const raw = clean(editing ? env.edit.buffer : String(w.value ?? ""));
  const mask = (s) => (w.password ? "*".repeat([...s].length) : s);
  const fieldStyle = style || "underline";
  if (w.multiline) {
    const rows = raw.split("\n");
    const cursorLine = editing ? raw.slice(0, env.edit.cursor).split("\n").length - 1 : -1;
    const height = Math.min(10, Math.max(w.rows || 2, rows.length));
    const out = [];
    for (let i = 0; i < height; i += 1) {
      const text = rows[i] ?? "";
      let shown;
      let cursorAt = -1;
      if (i === cursorLine) {
        const col = [...raw.slice(0, env.edit.cursor).split("\n").pop()].length;
        const chars = [...text];
        const start = Math.max(0, col - iw + 1);
        shown = sliceWidth(chars.slice(start).join(""), iw);
        cursorAt = col - start;
      } else {
        shown = truncate(text, iw, g);
      }
      out.push(fieldSegs(shown, cursorAt, iw, { open, close, style: fieldStyle, k, g }));
    }
    return out;
  }
  const flat = mask(raw.replace(/\n/g, " "));
  if (editing) {
    const chars = [...flat];
    const c = [...raw.slice(0, env.edit.cursor)].length;
    const start = Math.max(0, c - iw + 1);
    return [fieldSegs(sliceWidth(chars.slice(start).join(""), iw), c - start, iw, { open, close, style: fieldStyle, k, g })];
  }
  if (!flat && w.placeholder && w.focusable) {
    const ph = truncate(w.placeholder, iw, g);
    return [[seg(open, fieldStyle, k), seg(ph, "dim", k), seg(g.fill.repeat(iw - strWidth(ph)), fieldStyle, k), seg(close, fieldStyle, k)]];
  }
  return [fieldSegs(truncate(flat, iw, g), -1, iw, { open, close, style: fieldStyle, k, g })];
}

function fieldSegs(shown, cursorAt, iw, { open, close, style, k, g }) {
  const out = [seg(open, style, k)];
  if (cursorAt >= 0) {
    const chars = [...shown];
    out.push(seg(chars.slice(0, cursorAt).join(""), style, k), seg("", undefined, { cursor: true }), seg(chars.slice(cursorAt).join(""), style, k));
  } else {
    out.push(seg(shown, style, k));
  }
  out.push(seg(g.fill.repeat(Math.max(0, iw - strWidth(shown))), style, k), seg(close, style, k));
  return out;
}

// ------------------------------------------------------------ inline ----

/** The lines of one inline item at most `width` wide. */
function itemLines(item, width, env) {
  if (item.widget) return widgetLines(item.widget, width, env);
  return [[seg(truncate(String(item.text ?? ""), width, env.glyphs), item.style)]];
}

/**
 * A line of items: separated by one space, wrapped item by item when the
 * line is full; spacers share the room left when everything fits on one
 * line (a toolbar's right-aligned buttons). A multi-line item (a TextArea)
 * stands on lines of its own.
 */
export function flow(items, width, env) {
  const parts = [];
  const spacersBefore = [];
  let pendingSpacers = 0;
  for (const it of items) {
    if (it.spacer) {
      pendingSpacers += 1;
      continue;
    }
    if (it.text !== undefined && it.text === "") continue;
    const lines = itemLines(it, width, env);
    parts.push(lines);
    spacersBefore.push(pendingSpacers);
    pendingSpacers = 0;
  }
  if (!parts.length) return [];
  const widths = parts.map((ls) => Math.max(...ls.map(lineWidth)));
  const total = widths.reduce((a, b) => a + b, 0) + (parts.length - 1);
  const single = parts.every((ls) => ls.length === 1);
  const spacerCount = spacersBefore.reduce((a, b) => a + b, 0) + pendingSpacers;
  if (single && total <= width) {
    const extra = width - total;
    const line = [];
    // the room goes to the spacers; trailing ones count too
    const slots = spacersBefore;
    const per = spacerCount ? Math.floor(extra / spacerCount) : 0;
    let rest = spacerCount ? extra - per * spacerCount : 0;
    const room = (n) => {
      if (!n) return 0;
      let r = per * n;
      if (rest > 0) {
        r += rest;
        rest = 0;
      }
      return r;
    };
    parts.forEach((ls, i) => {
      const gap = (i > 0 ? 1 : 0) + room(slots[i]);
      if (gap) line.push(seg(" ".repeat(gap)));
      line.push(...ls[0]);
    });
    return [line];
  }
  const out = [];
  let cur = [];
  let used = 0;
  parts.forEach((ls, i) => {
    const w = widths[i];
    if (ls.length > 1) {
      if (cur.length) out.push(cur);
      out.push(...ls);
      cur = [];
      used = 0;
      return;
    }
    if (used > 0 && used + 1 + w > width) {
      out.push(cur);
      cur = [];
      used = 0;
    }
    if (used > 0) {
      cur.push(seg(" "));
      used += 1;
    }
    cur.push(...ls[0]);
    used += w;
  });
  if (cur.length) out.push(cur);
  return out;
}

// ------------------------------------------------------------ blocks ----

const BANNER = {
  error: { prefix: "Error: ", style: "red" },
  warning: { prefix: "Warning: ", style: "yellow" },
  success: { prefix: "Success: ", style: "green" },
  info: { prefix: "Info: ", style: "blue" },
  toast: { prefix: ">> ", style: "cyan" },
};

function textLines(text, width, style, maxLines, g) {
  // an empty text takes no room, as an empty UI5 Text
  if (String(text ?? "") === "") return [];
  let lines = wrap(String(text ?? ""), width);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = strWidth(last) + strWidth(g.ellipsis) <= width ? last + g.ellipsis : truncate(`${last} ${g.ellipsis}`, width, g);
  }
  return lines.map((l) => (l ? [seg(l, style)] : []));
}

/** Column widths for `natural` widths in `avail` columns: the narrow
 *  columns keep theirs, the wide ones share the rest (at least `min`). */
export function fitColumns(natural, avail, min = 3) {
  const sum = natural.reduce((a, b) => a + b, 0);
  if (sum <= avail) return natural.slice();
  const out = natural.map(() => 0);
  let open = natural.map((_, i) => i);
  let room = avail;
  for (;;) {
    const share = Math.floor(room / open.length);
    const fixed = open.filter((i) => natural[i] <= share);
    if (!fixed.length) break;
    for (const i of fixed) {
      out[i] = natural[i];
      room -= natural[i];
    }
    open = open.filter((i) => natural[i] > share);
    if (!open.length) break;
  }
  if (open.length) {
    const share = Math.floor(room / open.length);
    let rest = room - share * open.length;
    for (const i of open) {
      out[i] = share + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
    }
  }
  return out.map((w) => Math.max(min, w));
}

function tableLines(b, width, env) {
  const g = env.glyphs;
  const ncol = Math.max(b.header ? b.header.length : 0, ...b.rows.map((r) => r.cells.length));
  const gutter = b.rows.some((r) => r.action) ? 2 : 0;
  const selW = b.rows.some((r) => r.select) ? 4 : 0;
  const sep = b.plain ? "  " : ` ${g.v} `;
  const sepW = strWidth(sep);
  const avail = Math.max(ncol * 3, width - gutter - selW - sepW * Math.max(0, ncol - 1));
  const natural = Array.from({ length: ncol }, (_, c) => Math.max(
    b.header ? strWidth(b.header[c] || "") : 0,
    ...b.rows.map((r) => (r.cells[c] ? Math.max(0, ...layoutBlocks(r.cells[c], 60, { ...env, fill: false }).map(lineWidth)) : 0)),
    1,
  ));
  const widths = fitColumns(natural, avail);
  const out = [];
  const lead = (first, r) => {
    const s = [];
    if (gutter) {
      const focused = first && r && r.action && env.focus === r.action.key;
      s.push(seg(focused ? "> " : "  ", focused ? "reverse" : undefined, r && r.action ? { key: r.action.key } : undefined));
    }
    if (selW) {
      if (first && r && r.select) s.push(...widgetLines(r.select, 3, env)[0], seg(" "));
      else s.push(seg(" ".repeat(selW)));
    }
    return s;
  };
  if (b.header) {
    const line = lead(false);
    b.header.forEach((h, c) => {
      if (c > 0) line.push(seg(sep, "dim"));
      line.push(seg(pad(truncate(h || "", widths[c], g), widths[c]), "bold"));
    });
    out.push(line);
    const rule = [seg(" ".repeat(gutter + selW))];
    widths.forEach((w, c) => {
      if (c > 0) rule.push(seg(b.plain ? "  " : `${g.h}${g.h === "-" ? "+" : "\u253c"}${g.h}`, "dim"));
      rule.push(seg(g.h.repeat(w), "dim"));
    });
    out.push(rule);
  }
  for (const r of b.rows) {
    const cells = widths.map((w, c) => (r.cells[c] ? layoutBlocks(r.cells[c], w, { ...env, fill: true }) : []));
    const h = Math.max(1, ...cells.map((ls) => ls.length));
    for (let i = 0; i < h; i += 1) {
      const line = lead(i === 0, r);
      widths.forEach((w, c) => {
        if (c > 0) line.push(seg(sep, "dim"));
        line.push(...padLine(truncateLine(cells[c][i] || [], w, g), w));
      });
      out.push(line);
    }
  }
  return out;
}

/** An overlay or panel frame around `lines`: the title in the top border. */
export function frame(title, lines, width, env, style) {
  const g = env.glyphs || GLYPHS.ascii;
  const inner = width - 4;
  if (inner < 4) return [...(title ? [[seg(title, "bold")]] : []), ...lines];
  const head = title ? ` ${truncate(title, inner - 2, g)} ` : "";
  const out = [[seg(`${g.tl}${g.h}`, style), ...(head ? [seg(head, `bold${style ? ` ${style}` : ""}`)] : []), seg(`${g.h.repeat(Math.max(0, width - 3 - strWidth(head)))}${g.tr}`, style)]];
  for (const l of lines) out.push([seg(`${g.v} `, style), ...padLine(truncateLine(l, inner, g), inner), seg(` ${g.v}`, style)]);
  out.push([seg(`${g.bl}${g.h.repeat(width - 2)}${g.br}`, style)]);
  return out;
}

/** The widgets that stretch to the field column of a label-field row. */
const FILLING = new Set(["input", "choice"]);

function fieldRun(run, width, env) {
  const g = env.glyphs;
  const labelW = Math.min(Math.max(...run.map((f) => strWidth(f.label))), Math.floor(width / 3));
  const out = [];
  for (const f of run) {
    const label = f.label ? `${f.label}:` : "";
    if (width < 30) {
      if (label) out.push([seg(truncate(label, width, g), "bold")]);
      out.push(...flow(f.items, width, { ...env, fill: false }));
      continue;
    }
    const lw = labelW + 1;
    const rest = width - lw - 1;
    const items = flow(f.items.map((it) => (it.widget && FILLING.has(it.widget.kind) ? { ...it, widget: { ...it.widget, fillTo: Math.min(rest, 42) } } : it)), rest, { ...env, fill: false });
    const first = [seg(pad(truncate(label, lw, g), lw), "bold"), seg(" ")];
    if (!items.length) out.push(first);
    items.forEach((l, i) => out.push(i === 0 ? [...first, ...l] : [seg(" ".repeat(lw + 1)), ...l]));
  }
  return out;
}

/** Blocks -> lines at `width` columns. */
export function layoutBlocks(blocks, width, env) {
  const e = { glyphs: GLYPHS.ascii, ...env };
  const g = e.glyphs;
  const w = Math.max(1, width);
  const out = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    switch (b.t) {
      case "text":
        out.push(...textLines(b.text, w, b.style, b.maxLines, g));
        break;
      case "heading":
        out.push(...textLines(b.text, w, "bold", 0, g));
        break;
      case "blank":
        out.push([]);
        break;
      case "rule":
        out.push([seg(g.rule.repeat(w), "dim")]);
        break;
      case "inline":
        out.push(...flow(b.items, w, e));
        break;
      case "field": {
        const run = [b];
        while (blocks[i + 1] && blocks[i + 1].t === "field") run.push(blocks[(i += 1)]);
        out.push(...fieldRun(run, w, e));
        break;
      }
      case "cols": {
        const natural = b.cols.map((c) => Math.max(1, ...layoutBlocks(c, w, e).map(lineWidth)));
        const gap = 2;
        if (natural.reduce((a, x) => a + x, 0) + gap * (b.cols.length - 1) <= w) {
          const cols = b.cols.map((c, k) => layoutBlocks(c, natural[k], e));
          const h = Math.max(...cols.map((c) => c.length));
          for (let r = 0; r < h; r += 1) {
            const line = [];
            cols.forEach((c, k) => {
              if (k > 0) line.push(seg(" ".repeat(gap)));
              line.push(...(k < cols.length - 1 ? padLine(c[r] || [], natural[k]) : (c[r] || [])));
            });
            out.push(line);
          }
        } else {
          for (const c of b.cols) out.push(...layoutBlocks(c, w, e));
        }
        break;
      }
      case "box":
        out.push(...frame(b.title, layoutBlocks(b.blocks, w - 4, e), w, e, "dim"));
        break;
      case "table":
        out.push(...tableLines(b, w, e));
        break;
      case "banner": {
        const k = BANNER[b.kind] || BANNER.info;
        const pw = strWidth(k.prefix);
        const lines = wrap(b.text, Math.max(1, w - pw));
        lines.forEach((l, n) => out.push([seg(n === 0 ? k.prefix : " ".repeat(pw), `bold ${k.style}`), seg(l, k.style)]));
        break;
      }
      case "bar": {
        const n = Math.max(5, Math.min(20, w - strWidth(b.label) - 3));
        const full = Math.round((b.percent / 100) * n);
        out.push(truncateLine([seg("["), seg(g.bar.repeat(full), b.style), seg(g.barEmpty.repeat(n - full), "dim"), seg("] "), seg(b.label, b.style)], w, g));
        break;
      }
      case "page": {
        if (b.header.length) {
          out.push(...flow(b.header, w, e));
          out.push([seg(g.heavy.repeat(w), "dim")]);
        }
        out.push(...layoutBlocks(b.blocks, w, e));
        if (b.footer.length) {
          out.push([seg(g.rule.repeat(w), "dim")]);
          out.push(...layoutBlocks(b.footer, w, e));
        }
        break;
      }
      default:
        out.push([seg(`[? block ${b.t}]`, "dim")]);
    }
  }
  return out.map((l) => truncateLine(l, w, g));
}
