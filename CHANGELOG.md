# Changelog

## Unreleased

- **The UI5 SPA is conformant (ui5 profile).** CI's frontend job pins
  abap2UI5 main `1bbb9d4`, which carries the fix of `portable.box-details`
  (abap2UI5 `72c86cc`); `test/frontend.test.mjs` no longer accepts that
  deviation, so a frontend that loses the fix fails the test. 77 pass,
  0 fail, 4 skip (RESULTS.md).
- **Adaptive Cards: app text is never Markdown.** A `TextBlock` or `Fact`
  whose text has Markdown syntax is a `RichTextBlock` `TextRun` now: a
  model value or toast like `[verify your account](https://evil.example)`
  was a live link in Teams and Copilot.
- **`htmlToText` is linear.** Its patterns scanned from every `<` to the
  end of the text (and the `<script>` pattern lazily to every later
  closing tag): 100k characters of `<` in a message box's details held the
  renderer for seconds. A lone `<` is now kept as text.
- **Terminal renderer** (`renderers/terminal/`, export
  `@abap2ui5/protocol/renderers/terminal`, CLI `abap2ui5-tui <url> [--app
  <CLASS>] [--user u --password p | --cookie c] [--print] [--no-color]`):
  an abap2UI5 app in a terminal. Its session speaks the protocol to any
  backend - the node runtime, cap2UI5, an SAP system's ICF node (basic
  auth, cookies, the CSRF token handshake, `sap-contextid`, the terminate
  HEAD) - and keeps a hash history synchronised like the UI5 router, so
  Back restores routes. All 65 portable controls as keyboard widgets
  (fields edited in place, toggles, pick lists, buttons and links, tables
  with row selection and row actions, banners, overlay frames for dialogs,
  popovers and message boxes), unknown controls as visible placeholders;
  edits travel as the UI5 frontend's delta, field events (`change`,
  `select`, `submit`, ...) are raised. Respects the width (wrapping,
  ellipsis, wide characters), colors only when wanted (`NO_COLOR`,
  `--no-color`), `--print` renders once as plain text. Text from the
  backend is sanitised of control characters. Pure Node, no dependencies.
  The README's mapping table is generated from `mapping.mjs`
  (`scripts/render-terminal.mjs`, part of `npm run generate`).
- **Frontend adapter `terminal`** (in process, driven with keys through the
  renderer's state machine): 72 pass, 0 fail, 9 skip (a DOM, a programmatic
  model edit; the UI5 and semantic profiles) - the router checks included.
  Pinned in `test/frontend.test.mjs`; `test/terminal.test.mjs` holds golden
  screens, the keys down to the request body, width, colors, sanitising
  and the CLI; `test/backends.test.mjs` drives the renderer against the
  node-runtime host after the backend suite.
- **`renderers/common/`**: the render-agnostic half of the Adaptive Cards
  renderer (view helpers over the vendored `viewxml` / `snapshot` modules,
  the payload -> request step) moved out for both renderers; the card
  renderer re-exports it unchanged (its golden cards are byte-identical).
- **`portable.box-details` no longer asks for a DOM** - it reads only the
  text on screen. The Adaptive Cards renderer now runs and passes it (66
  pass, 15 skip).

- **Specification revision 0.3 - the maintainer's decisions** on the ten
  open questions ([spec/open-questions.md](spec/open-questions.md), each now
  "Decided (revision 0.3)" with its rationale):
  - NEST/NEST2 stay tolerated-not-rendered by portable renderers; portable
    *apps* must not use them - the abap2UI5 linter's portable rule
    (`profiles/portable.md` section 2).
  - A backend MUST NOT reflect request data it did not validate into the
    error body (`spec/errors.md`); new backend check **`error.no-reflection`**
    (MUST). Both reference backends (abap2UI5 1.146.0 via
    `@abap2ui5/node-runtime`, cap2UI5 on it) fail it - the URL is reflected
    verbatim by [H] `request_context_info`; the fix is made in abap2UI5
    core. Pinned as an expected failure in `test/lib/expected.mjs`; the
    suite traffic is recorded again (`counts.fail` 1 on both).
  - Message box details shown expanded (the UI5 frontend is being fixed),
    one roundtrip at a time with the client queueing (`spec/transport.md`),
    `sap-contextid` kept by every HTTP frontend - as they were.
  - **`portable-v1.json` separates the client API from the wire**: a new
    `actions` object with `actions.api` (the `follow_up_action( )` names a
    portable app may call) and `actions.wire` (what a renderer receives:
    `VIEW_SLOTS`, `ROUTER` with its `routerOptions`, the names folded into
    `ROUTER` - `foldedIntoRouter` - and the `T_CUSTOM` / `.eF` names).
    Additive: `frontendActions` stays as it was (`allowed` = `actions.api`),
    the profile stays version 1; consumers that copy the file (the Web
    Components frontend) keep working and re-copy it to read the new key.
    Schema, `scripts/render-portable.mjs` (a generated table in
    `profiles/portable.md` section 6) and `scripts/gen-portable-profile.mjs`
    follow.
- **Adaptive Cards renderer prototype** (`renderers/adaptive-cards/`,
  export `@abap2ui5/protocol/renderers/adaptive-cards`): an abap2UI5
  response (portable profile) -> an Adaptive Card 1.5, and an
  `Action.Submit` payload -> the next protocol request (event, arguments,
  the model delta of the changed inputs, whose ids are binding paths). All
  65 controls of portable profile v1 mapped (the README's mapping table is
  generated from `mapping.mjs`), unknown controls as placeholders listed in
  `unsupported`, a minimal card host speaking the protocol over HTTP, a demo
  for the designer, golden cards of recorded traffic. Pure Node, built on
  the vendored mcp-server `viewxml` / `snapshot` modules.
- **Frontend adapter `adaptive-cards`** (in process): the renderer passes
  every one of the 65 checks of the portable profile it can be driven
  through (16 skipped: URL, DOM, focus, title, model edits; UI5 and semantic
  profiles). Pinned in `test/frontend.test.mjs`; CI uploads its report.
- **Agent client re-vendored** at abap2UI5/mcp-server `a4d9f07` (PR #44):
  it now follows every frontend rule that applies - 61 pass, 0 fail, 0
  warn, 20 skip (was 5 MUST failures and 3 warnings at `ea4e9fa`); the pin
  in `test/frontend.test.mjs` follows. The Web Components frontend at its
  main `410d607` measures 68 pass / 0 fail / 13 skip, with
  `model.number-and-boolean` failing intermittently (RESULTS.md).
- The UI5 SPA pin accepts `portable.box-details` passing (its fix is under
  way); CI checks that `npm run generate` leaves no diff.

- **Frontend conformance suite** (`abap2ui5-conformance frontend --adapter
  ui5|agent|webcomponent [--profile core|portable|ui5|semantic]`, library
  `runFrontendSuite`, also at `@abap2ui5/protocol/frontend`): a scripted
  backend answers the frontend under test from the recorded traffic plus
  synthetic edge cases (PROTOCOL 3, no PROTOCOL, 500 with markup, CSRF token
  layer, unknown follow-up action, NEST slots, a model push of another
  app); 81 checks (66 MUST, 15 SHOULD) over the request side (envelope, ID
  continuation, event arguments, model delta, CONFIG cadence, headers,
  stateful session id, CSRF handshake, no retry of a 500, one roundtrip at
  a time) and the response side (PROTOCOL, unknown keys, view slots, model
  push, follow-up actions, messages, router, errors) per profile.
- **Adapters:** the UI5 SPA (abap2UI5 `app/webapp`) in Chromium via
  Playwright, UI5 from the `@openui5` npm packages (no CDN); the agent
  client of abap2UI5/mcp-server (vendored at `ea4e9fa`, `npm run
  vendor:agent`); the UI5 Web Components frontend (`dist/abap2ui5-wc.js`);
  a documented stub for the headless ABAP simulator (no HTTP seam yet).
- **Results** ([conformance/RESULTS.md](conformance/RESULTS.md#frontend-suite)):
  the UI5 SPA passes every MUST but `portable.box-details` (message box
  details empty on OpenUI5 >= 1.120); the agent client fails 5 MUSTs.
- **Specification revision 0.2** - the frontend side made explicit where the
  suite found it implicit, each with its source: a frontend sends event
  arguments as raw JSON values and never converts them itself; an app start
  names its class; `MODEL` carries only edited attributes, a pushed value is
  no edit; a table cell travels as `__delta` (SHOULD) or as the whole
  table; `sap-contextid-accept: header` SHOULD; the session id is kept by
  every HTTP frontend; "one roundtrip at a time" covers programs driving a
  frontend; a PROTOCOL mismatch adopts nothing; an error body is shown
  verbatim, its markup not interpreted; message box details are shown with
  the box; the UI5 frontend is no longer called "a portable frontend by
  construction" - it renders every portable app but fails a view on an
  element it cannot load (`profiles/portable.md`). Every frontend rule names
  its frontend checks.
- **`spec/open-questions.md`**: the provisional decisions for the
  maintainer - the NEST rule, a new draft id per response, the URL in the
  error body, boolean arguments for non-ABAP backends, the detail of an
  app's error, and five from the frontend suite.
- CI: a `frontend` job (Chromium, abap2UI5 `app/webapp` at `5d7e91f` (main))
  runs the UI5 SPA; `npm test` runs the agent client always.

## 0.1.0 - 2026-10-03

First version.

- **Specification** of protocol 2 (revision 0.1), derived from abap2UI5
  1.146.0: core (`spec/core.md`), transport, request, response, actions,
  sessions, navigation, errors, versioning - every normative statement
  traced to its source.
- **View profiles:** UI5 (`profiles/ui5.md`); portable v1
  (`profiles/portable.md`, `portable-v1.json`, `portable-coverage.md`) from a
  census of 247 core apps and 642 samples-controls ports; semantic - agent
  snapshot v1, moved here from abap2UI5/mcp-server as the normative version.
- **JSON Schemas** (2020-12) for the request, the response, the snapshot and
  the portable profile.
- **Backend conformance suite** (`abap2ui5-conformance backend`, library
  `runBackendSuite`): 75 checks, profiles `core` and `ui5`.
- **Conformance apps** `Z2UI5_CL_CONF_*` in ABAP (abapGit) and as cap2UI5
  apps; reference hosts for `@abap2ui5/node-runtime` and cap2UI5.
- **Recorded traffic** of both reference backends (suite, UI5 frontend code,
  agent client). Both pass every MUST; cap2UI5 warns on `error.details`.
