#!/usr/bin/env node
/*
 * abap2ui5-tui - run an abap2UI5 app in the terminal.
 *
 *   abap2ui5-tui <url> [--app <CLASS>] [--user <u> --password <p> | --cookie <c>]
 *                [--header "<name>: <value>"]... [--print] [--width <n>]
 *                [--no-color | --color] [--ascii | --unicode]
 *
 * <url> is the backend's HTTP endpoint: the abap2UI5 node runtime
 * (http://localhost:3000/), a cap2UI5 service, or the ICF node of an SAP
 * system (https://host/sap/bc/z2ui5?sap-client=100). The password may
 * come from ABAP2UI5_PASSWORD instead of the command line.
 *
 * --print renders the first screen once as text and exits (logs, CI,
 * screen readers): the page, then every popup and message box below it;
 * what could not be rendered goes to stderr. Exit code 0, 1 when the
 * backend answered with an error, 2 on a usage error.
 */
import { createSession } from "../session.mjs";
import { createTerminalApp } from "../app.mjs";
import { runTui } from "../tty.mjs";
import { colorWanted, unicodeWanted } from "../text.mjs";
import { renderScreen } from "../render.mjs";

const USAGE = `usage: abap2ui5-tui <url> [--app <CLASS>] [--user <u> --password <p> | --cookie <c>]
                    [--header "<name>: <value>"]... [--print] [--width <n>]
                    [--no-color | --color] [--ascii | --unicode]

  <url>            the backend endpoint (node runtime, cap2UI5, an SAP ICF node)
  --app <CLASS>    the app class to start (default: the backend's start app)
  --user, --password  basic authentication (or ABAP2UI5_PASSWORD)
  --cookie <c>     cookies to send ("name=value; name2=value2")
  --header <h>     an extra request header, repeatable
  --print          render once as plain text and exit (no keys)
  --width <n>      the width of --print (default: the terminal's, else 80)
  --no-color       no ANSI colors (also: NO_COLOR=1); --color forces them
  --ascii          ASCII frames (default unless the locale is UTF-8)

keys: Tab/Shift+Tab move, Enter press, Space toggle, Esc close, Alt+Left back,
      F1 all keys, Ctrl+C quit`;

function parse(argv) {
  const o = { headers: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      i += 1;
      return argv[i];
    };
    switch (a) {
      case "--app": o.app = val(); break;
      case "--user": o.user = val(); break;
      case "--password": o.password = val(); break;
      case "--cookie": o.cookie = val(); break;
      case "--header": {
        const h = val();
        const k = h.indexOf(":");
        if (k <= 0) throw new Error(`--header "${h}" is no "name: value"`);
        o.headers[h.slice(0, k).trim().toLowerCase()] = h.slice(k + 1).trim();
        break;
      }
      case "--print": o.print = true; break;
      case "--width": o.width = Number(val()); break;
      case "--no-color": o.color = false; break;
      case "--color": o.color = true; break;
      case "--ascii": o.unicode = false; break;
      case "--unicode": o.unicode = true; break;
      case "-h": case "--help": o.help = true; break;
      default:
        if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
        rest.push(a);
    }
  }
  [o.url] = rest;
  if (rest.length > 1) throw new Error(`one URL, not ${rest.length}`);
  return o;
}

async function main() {
  let o;
  try {
    o = parse(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e.message}\n${USAGE}\n`);
    return 2;
  }
  if (o.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!o.url) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    new URL(o.url);
  } catch {
    process.stderr.write(`not a URL: ${o.url}\n`);
    return 2;
  }
  const password = o.password ?? process.env.ABAP2UI5_PASSWORD;
  const out = process.stdout;
  const color = colorWanted({ flag: o.color, stream: out });
  const unicode = o.unicode ?? (!o.print && unicodeWanted());
  let app = null;
  const session = createSession({
    url: o.url, user: o.user, password, cookie: o.cookie, headers: o.headers,
    // --print takes the first screen: no timers fire into it
    timers: !o.print,
    onChange: () => app && app.redraw && app.redraw(),
  });
  const width = o.width || (o.print ? (out.isTTY ? out.columns : 80) : out.columns) || 80;
  app = createTerminalApp({ session, width, height: out.rows || 24, color, unicode });
  if (o.print) {
    await session.start(o.app || "");
    await session.settle();
    out.write(`${app.print()}\n`);
    for (const u of renderScreen(session.state, { messages: session.messages, error: session.error }).unsupported) process.stderr.write(`unsupported: ${u.control}${u.id ? ` #${u.id}` : ""} (${u.slot}) - ${u.reason}\n`);
    for (const l of session.log) process.stderr.write(`${l}\n`);
    await session.terminate();
    return session.error ? 1 : 0;
  }
  if (!process.stdin.isTTY || !out.isTTY) {
    process.stderr.write("abap2ui5-tui needs a terminal - use --print to render once as text\n");
    return 2;
  }
  session.start(o.app || "").catch(() => {});
  await runTui({ app, input: process.stdin, output: out });
  return 0;
}

main().then((code) => process.exit(code), (e) => {
  process.stderr.write(`${(e && e.stack) || e}\n`);
  process.exit(1);
});
