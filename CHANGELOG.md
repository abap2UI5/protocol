# Changelog

## Unreleased

- **The row delta of a table behind a data reference** (abap2UI5 #3026,
  `2cc0344`). An attribute `TYPE REF TO data` bound dereferenced is the
  model node `/<attr>/*`; its cell travels as `{ "MR_TAB": { "*": {
  "__delta": { ... } } } }` - the backend reads every entry at the
  attribute's client name ([MOD] `main_json_to_attri`), and a whole
  attribute is refused for a windowed table, where the edit was lost.
  - `spec/request.md`: the `/MR_TAB/*/<row>/<FIELD>` row of the delta
    table, a structure or value behind a reference still whole, a frontend
    MUST put the `__delta` on the `*` node; an implementation note for the
    backend side. `spec/windowed-tables.md` *Edits*: the same for a
    windowed table behind a reference, and the 1.149.0 behaviour as an
    implementation note.
  - New frontend check `window.edit-as-delta-reference` (MUST, core,
    synthetic: no conformance app binds a data reference) - 86 checks
    (71 MUST, 15 SHOULD; 69 core). The agent client, the Adaptive Cards and
    the terminal renderer pass it (64, 69, 75); the UI5 SPA of 1.149.0 fails
    it and is pinned in `test/frontend.test.mjs` `UI5_KNOWN_FAILS` until
    CI's abap2UI5 commit carries `2cc0344` (finding 3 of
    `conformance/RESULTS.md`; that frontend passes).
  - `schema/request.schema.json`: a `{ "*": { "__delta" } }` entry is
    validated as a table delta; three valid and two invalid hand-made
    requests in `test/schema.test.mjs` (the recorded traffic has none).
  - Agent client re-vendored at abap2UI5/mcp-server `a521248` (its
    `7f71d5f`: `buildDelta` as the fixed `buildDeltaFromPaths`; the two
    other modules unchanged). `profiles/semantic.md`: the pick of a
    selection dialog over a data reference sends that delta; the F4
    example is the re-recorded one of mcp-server (`z2ui5_cl_cgui_select`).
  - [Open question 14](spec/open-questions.md#14-tables-behind-a-data-reference-in-the-backend-suite):
    whether a backend check (and a conformance app with a data reference,
    twice) should pin the backend side.

- **Agent client re-vendored at abap2UI5/mcp-server `8efb3d7`** (its #71,
  windowed tables; `82b75d8` before; `npm run vendor:agent`, `--check`
  passes). Between the two commits the three vendored modules also
  describe a table bound to a dereferenced data reference (`{/MR_X/*}`,
  #63), refuse a response whose action list is no list and take a
  per-call abort `signal` (#50) - no snapshot key changes with those.
  The snapshot changes with #71, additively (`snapshotVersion` stays 1):
  - `profiles/semantic.md`: a windowed table's `rowCount` is the rows held,
    the new `total` is `/__WINDOW/<path>/TOTAL`, `truncated` is true while
    rows are missing and `window: { size, more? }` names the call that
    loads the next window; `app_act` takes `window: { table, count?,
    sort?, filter? }` and sends `___ZZZ_WIN` as the UI5 list binding does;
    a `BINDING_CALL` sort or filter wire on a windowed table is the action
    `@BINDING_CALL` (it was listed under `unsupported`). New section
    *Windowed tables*; the sentence that nothing in snapshot v1 names
    `TOTAL` is gone.
  - `schema/snapshot.schema.json`: optional `tables[].total` (integer >= 0)
    and `tables[].window` (`size` integer >= 1, `more` string); five
    invalid samples in `test/schema.test.mjs`.
  - [Open question 13](spec/open-questions.md#13-windowed-tables-in-frontends-that-are-not-the-ui5-frontend)
    stays open: the current decision records that the semantic profile took
    alternative (c) as additive keys of v1, after the agent client; the
    keys are optional and window requests stay a MAY. Whether the other
    frontends must show or fetch the missing rows is the maintainer's.
  - `conformance/RESULTS.md`: the agent client passes 63 of 85, 22
    skipped, as before - `window.rows-shown` and `window.edit-as-delta`
    pass; its row in *Windowed tables* now shows `total` and the window
    requests.
  - Agent traffic recorded again from both hosts with a `git archive` of
    `8efb3d7`: the nine exchanges and snapshots of before are unchanged but
    for the draft ids; the recorder now also drives the app WINDOW - its
    start, the `@BINDING_CALL` of "Sort list", the next window and a
    filter (`["/T_ROWS","4","[{\"PATH\":\"QTY\",\"DESCENDING\":true}]"]`,
    `["/T_ROWS","8"]`, `["/T_ROWS","4","","[[[\"NAME\",\"Contains\",\"1\",null]]]"]`,
    what the UI5 list binding sends), the same on both hosts. The schemas
    now validate 482 requests, 466 responses and 26 snapshots.
    `semantic.snapshot-schema` also validates the snapshot of a windowed
    table, and `semantic.recorded-snapshots` replays the WINDOW start and
    the `@BINDING_CALL` (the window requests are no adapter interaction).
    `suite.json` and `ui5-frontend.json` recorded in the same run differed
    only in draft ids, ports, ETags, timestamps and the checkout's name and
    were left as they were.
- **Specification revision 0.5 - re-derived from abap2UI5 1.149.0**
  (release commit `6f55b04`; revision 0.4 was derived from `610d9ae`,
  1.148.0). Unlike the release before, this one changes the wire.
  Protocol 2 stays: `c_protocol` is 2 in 1.149.0, the frontend's
  `PROTOCOL` too, and what is new is additive - a reserved model key, a
  reserved event the backend answers itself, three follow-up actions
  (`spec/versioning.md`). For the 77 checks of revision 0.4 the recorded
  traffic of 1.149.0 is identical to that of 1.148.0 (draft ids, the
  version line of the error bodies and the page's `ETag` normalized). What
  moved, each confirmed in the release's source and in recorded traffic
  unless it says otherwise:
  - *Windowed tables* - new [spec/windowed-tables.md](spec/windowed-tables.md).
    A table bound with `window_bind_tab( )` arrives as its first window,
    the window state under `/__WINDOW/<path>` (`TOTAL`, `COUNT`, `SIZE`).
    The reserved event `___ZZZ_WIN` asks for more rows (`[path, count]`), a
    sort (`[path, count, sortJSON]`) or a filter (`[path, count, "",
    filterJSON]`); the backend answers it without calling `main( )`. A part
    that is missing, empty or `null` is kept, `[]` clears it; the order is
    the backend's and travels with the draft; there is one sort, the last
    one set; the app's filter and the list's are ANDed; the rows of a
    `__delta` are positions in the order the backend sent, and a whole
    table value is refused. Core rules with thirteen backend checks
    (`window.*`) and two frontend checks (`window.rows-shown`,
    `window.edit-as-delta`); what the UI5 list binding sends is the UI5
    profile's (`profiles/ui5.md#windowed-tables`, frontend checks
    `ui5.window-growth`, `ui5.window-sort-filter`). Not in portable v1.
    Two provisional decisions:
    [open questions 12 and 13](spec/open-questions.md#12-windowed-tables-as-a-part-of-the-core-protocol).
  - *Schemas.* `response.schema.json` describes `MODEL.__WINDOW`,
    `request.schema.json` the arguments of `___ZZZ_WIN`; both stay open for
    everything else.
  - *Follow-up actions.* `SET_APP_FULL_WIDTH`, `CROSS_APP_NAV_GET_LINKS`
    (its answer is a backend event whose first argument is the text of a
    JSON array) and the experimental `OFFLINE_QUEUE`, which changes when
    requests are sent and nothing in them (`spec/actions.md`). All three
    are UI5-profile actions and excluded from the portable profile
    (`profiles/portable-v1.json`, `frontendActions.excluded`). Their shapes
    were read from the source and seen once in a scratch transpile
    (`["SET_APP_FULL_WIDTH","X"]`, `["SET_APP_FULL_WIDTH"]`,
    `["OFFLINE_QUEUE", <text>, <event>...]`,
    `["CROSS_APP_NAV_GET_LINKS", <target>, <params>, <event>]`); no
    conformance app queues them, so they are not in `traffic/`.
  - *Bound action arguments.* A `${/PATH}` argument of a queued action is
    resolved against the model of the slot the answering app filled, no
    longer MAIN's ([SL] `responseModel`; open question 11 unchanged).
  - *Model delta.* The rule for a value the backend cannot write names a
    whole scalar as well as a cell (new backend check
    `model.unconvertible-scalar-skipped`, SHOULD) - behaviour of the
    reference before 1.149.0 too, which only documents it now.
  - *Launchpad.* The UI5 frontend names the logon client on the endpoint
    (`sap-client=<3 digits>`) when the endpoint is on the page's origin and
    names none - a query parameter, implementation note in
    `spec/transport.md` (source only: no launchpad in the suite).
  - *App-state hash.* A draft that exists but cannot be restored ends in
    an error response instead of the "expired" toast (implementation note
    in `spec/navigation.md`, source only).
  - *UI5 profile.* The eight invisible custom controls (`z2ui5.cc.Timer`,
    `Focus`, `Scrolling`, `Title`, `LPTitle`, `Favicon`, `History`, `Info`)
    are gone; a view that names one fails to load. No schema, enum or
    profile list of this repository named them - `z2ui5.cc` is excluded
    from the portable profile as a namespace. The UI5 frontend no longer
    refuses to send while `navigator.onLine` is false.
  - *Not on the wire.* The draft frame that keeps a windowed table next to
    the app's serialization and reuses its serialized rows ([TY]
    `ty_s_kept`) is internal: no message differs, and
    `window.order-with-the-draft` reads the same draft back twice.
  - *Citations.* The message box's type mapping is [MSG] `box_resolve`
    (`z2ui5_cl_ui5_srv_message`; it left [FE]). New source abbreviations
    [WIN], [BND], [MSG], [WM], [LP], [OFF].
- **Conformance app WINDOW** (`Z2UI5_CL_CONF_WINDOW`, ABAP and cap2UI5
  twin): twelve rows, four at a time, an app sort and filter, a counter of
  `main( )` calls, two wired `BINDING_CALL` buttons.
- **node-runtime host on 1.149.0.** `@abap2ui5/node-runtime` 1.148.0 ->
  1.149.0, `@abaplint/transpiler-cli` 2.14.5 -> 2.14.33 (the transpiler the
  package names); `build.mjs` and `serve.mjs` are unchanged - the recipe of
  1.148.0 holds. Traffic recorded again from both hosts with the UI5
  frontend of the release commit, whose `core/WindowModel.js` the recorder
  now runs as well. Results: `node-runtime` 91 of 91.
- **cap2UI5 host on `@cap2ui5/cds-plugin` 0.6.0** (0.5.0 before), which
  hosts the runtime 1.149.0 and has `window_bind_tab( )`: 90 of 91 pass,
  with the known `error.details` warning. On 0.5.0 (runtime 1.147.0) the
  start of the app WINDOW failed and the thirteen window checks with it;
  they were pinned for `cap2ui5` until the plugin was released, and are
  unpinned. The pins of `test/lib/expected.mjs` are per backend now,
  failures and warnings (one list for both hosts before);
  `test/traffic.test.mjs` compares the two recordings for every check, the
  window exchanges included - they are identical.
- **CI's frontend job pins abap2UI5 `6f55b04`** (Release 1.149.0); the UI5
  SPA passes 81 of the 85 frontend checks, 4 skipped.
- **The vendored agent client is `82b75d8`** - README and RESULTS named
  `a4d9f07`, the commit before the re-vendoring of #5; settled from
  `adapters/vendor/mcp-server/source.json` and `vendor-agent-client.mjs
  --check`. The agent traffic is recorded from a checkout of that commit.
- **Specification revision 0.4 - re-derived from abap2UI5 1.148.0**
  (release commit `610d9ae`; revisions 0.1 to 0.3 were derived from
  `b812079`, 1.146.0). Protocol 2 stays: `c_protocol` is 2 in 1.148.0, and
  nothing below removes or retypes a key. What moved on the wire, all of
  it released with 1.147.0 (1.148.0 changed the Node packaging and moved
  helper methods, not the wire) and each confirmed in the release's source
  or in the recorded traffic:
  - *Error body.* The request URL in the first frame is stripped to an
    allow-list ([H] `context_info_url_safe`); `error.no-reflection` passes
    on both reference hosts and is unpinned (`test/lib/expected.mjs` pins
    nothing).
  - *App start.* An app-state hash restores its draft when the request
    names no class; when that draft is gone the start app answers, with a
    toast (`spec/navigation.md`; new backend check
    `route.app-state-names-no-app`, SHOULD - the suite has 77 checks).
  - *Session block.* The UI5 frontend sends `S_UI5` alone with the first
    request that finds it loaded instead of repeating the whole static
    block until then; the backend merges an `S_UI5` that comes without the
    device profile. Numbers of the block the backend cannot hold are read
    as absent instead of failing the request (`spec/request.md`). The
    frontend check `request.config-cadence` flags only a block the backend
    already has.
  - *Event arguments.* A binding context travels as `{ PATH, OBJECT }`,
    the UI5 event itself as `{ ID, SOURCE, PARAMETERS }`; a request that
    cannot be serialized is not sent (`spec/request.md`). A raw wire
    argument whose braces do not balance is quoted (`profiles/ui5.md`).
  - *Follow-up actions.* The UI5 frontend resolves a `${/PATH}` argument of
    a queued action against the model. Recorded, not required - new
    [open question 11](spec/open-questions.md#11-bound-arguments-of-queued-follow-up-actions).
  - *Embedded frontends.* A host can hand the URL back to the component
    (`ownsPage`); it then sends `HASH` and follows the router rules.
  - *Transport, UI5 profile.* `GET ?z2ui5-bundle=devtools` answers the
    developer tools, which left the page; `serve()` of
    `@abap2ui5/node-runtime` puts a Host/Origin guard of its own in front
    of the framework (implementation note in `spec/transport.md`).
  - *Response.* Control characters in strings are escaped in the finished
    JSON text (implementation note in `spec/response.md`).
  - *Not in 1.148.0*, and so not in this revision: windowed tables
    (`_bind_tab( window )`, `/__WINDOW/<path>/TOTAL`), the frontend actions
    `set_app_full_width` and `cross_app_nav_get_links`, and the removal of
    the invisible custom controls are unreleased entries of abap2UI5's
    changelog. Schemas and the portable profile are unchanged: every
    message of the new recordings validates, the action vocabulary
    (`cs_event`) is the one of 1.146.0.
- **Reference hosts moved.** `@abap2ui5/node-runtime` 1.146.0 -> 1.148.0,
  `@cap2ui5/cds-plugin` 0.4.0 -> 0.5.0 (which pins the runtime 1.147.0),
  traffic recorded again from both. `conformance/hosts/node-runtime`
  follows the package's new recipe for a host's own classes: one transpile
  of the framework and the conformance apps by `abap2ui5-transpile` with
  `@abaplint/transpiler-cli` 2.14.5, served through the output's
  `host.mjs` (the `apps/index.mjs` way is deprecated in 1.148.0); the two
  git libraries are cached under `node_modules/.cache/`. The suite and the
  recorder start it with the host guard off, so the framework's CSRF gate
  answers `transport.csrf-origin`. Results: `node-runtime` 77 pass,
  `cap2ui5` 76 pass and the known SHOULD warning (RESULTS.md).
- **CI's frontend job pins abap2UI5 `610d9ae`** (Release 1.148.0) instead
  of main `1bbb9d4`; the UI5 SPA's result is unchanged, 77 pass, 4 skip.
- **Renamed references.** [HF] is
  `src/z2ui5_cl_frontend_sim.clas.abap` (was `..._simulator`);
  `profiles/ui5.md` no longer cites [EV] `escape_js_string` and [HTTP]
  `_check_etag_match`, which 1.148.0 moved into
  `z2ui5_cl_ui5_util_context`.
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
- **Terminal session: a cookie the system deletes is dropped.** A
  `Set-Cookie` with `Max-Age=0` or an `Expires` in the past (an ended
  session, a logoff) was kept in the jar and sent on every later request.
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
