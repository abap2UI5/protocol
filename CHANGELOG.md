# Changelog

## Unreleased

- **An invisible column takes its cells with it** (2026-11-27): the
  Adaptive Cards and the terminal renderer left out the header of a
  `Column` with `visible="false"` but rendered the cell of its index in
  every row - under the next header, and on the card as data. Both now
  match cells to columns by position, as UI5 does.
- **Frontend checks that passed vacuously** (2026-11-27): `error.as-text`
  and `message.details-sanitized` probed the DOM with
  `document.querySelector`, blind to a shadow root - a DOM adapter now
  answers `query(selector)` across open shadow roots (`deepCount` in
  `adapters/base.mjs`, the `ui5` and `webcomponent` adapters), and the
  `webcomponent` adapter reads the error from the dialog it shows, not
  from its event. `transport.one-at-a-time` and
  `transport.tick-keeps-event` skip instead of passing (or warning) when
  the frontend cannot make the second press. The Web Components frontend
  is run on protocol 3 (`conformance/RESULTS.md`): its main fails
  `message.details-sanitized` (an `<img>` in the box details reached the
  DOM) and warns on `transport.tick-keeps-event`; both are fixed on its
  branch, which passes 76 of the 76 portable checks that apply.

- **Both reference hosts on the releases with protocol 3** (2026-11-27):
  abap2UI5 1.151.0 (2026-11-26) is the first release that speaks protocol
  3, and `@cap2ui5/cds-plugin` 0.8.0 hosts its runtime. `package.json`
  pins `@abap2ui5/node-runtime` 1.151.0 (1.150.0 before) and
  `@abaplint/transpiler-cli` 2.14.35, the transpiler the package names;
  the cap2UI5 host pins the plugin 0.8.0 (0.7.0 before). The specification
  revision stays 0.9 - the release carries the wire it describes.
  - Neither backend is *behind* any more (`test/lib/expected.mjs` reads
    what is installed): node-runtime passes 94 of 94, cap2UI5 93 of 94
    with `error.details` warning, as before - and every check of the
    windowed tables, so the nine window pins of the cap2UI5 host are
    gone.
  - Traffic recorded again on the releases: `traffic/node-runtime/`
    (`suite.json`, `ui5-frontend.json` from the `bundle/webapp` of
    1.151.0) - only draft ids, ports, ETags, versions and timings moved -
    and `traffic/cap2ui5/` again (`suite.json`, `ui5-frontend.json`).
    `CAP_TRAFFIC_MISSING` is null, `BACKEND_TRAFFIC_APART` empty: the two
    backends are compared check by check again, the windowed tables
    included.
  - One new difference, within the spec: cap2UI5 answers the timer tick
    that changed nothing with the id it continued (the MAY of
    `spec/sessions.md`), the node-runtime host with a new one -
    `session.timer-tick` is compared with every draft id alike
    (`BACKEND_TRAFFIC_IDS_APART`).
  - The UI5 SPA of 1.151.0 passes 98 and skips 4 of the frontend suite,
    as the one of DEV `a9c08191`.
  - Still behind: the agent client vendored from mcp-server `332a0b0`
    (protocol 2; mcp-server reads protocol 3 from `7906a2f`), and
    `traffic/node-runtime/agent-client.json` with it.
  - README, spec status lines, `conformance/RESULTS.md` (*The release
    1.151.0*), the CI comments and the test comments say what is
    released; abap2UI5's development line is `main`.

- **The ABAP conformance apps downport to 7.02 and rename into another
  namespace** (2026-11-26), like every repository of the abap2UI5
  ecosystem: `npm run lint:abap:702` (a copy downported and linted at v702
  against abap2UI5 1.151.0-702) and `npm run rename` (the shared
  `scripts/rename.mjs`, abap2UI5 1.151.0 renamed along), both CI steps.
- **`SET_TITLE_LAUNCHPAD` follows the owns-the-page rule** (2026-11-25):
  like `SET_TITLE`, an embedded component that does not own the page sets
  no shell title with it (abap2UI5 DEV `bd85ca52`, [LIB] `setShellTitle`);
  the implementation note in
  [spec/actions.md](spec/actions.md#the-title) is replaced by the rule.
- **Specification revision 0.9 - the timer the backend keeps, and the
  title in the launchpad** (2026-11-24), derived from abap2UI5 branch
  `DEV` at `a9c08191`. No wire change: protocol 3 stays, no action,
  element, request field or response section is new
  ([spec/versioning.md](spec/versioning.md#compatible-changes-within-protocol-3)).
  - **A timer the backend keeps** - new section
    [spec/actions.md](spec/actions.md#a-timer-the-backend-keeps). abap2UI5
    lets an app declare its repeating timer (`client->timer_set( )` /
    `timer_stop( )`) and writes the actions itself ([H]
    `main_end_timer`, [ACT] `prepare_app_stack`, [CONT] `ms_timer`). A
    backend MAY send a repeating `START_TIMER` again whenever the app gets
    the screen again (a request without a draft id - page load,
    Back/Forward restore, app-state link -, a hop to the app, a changed
    declaration) and MAY put `STOP_TIMER` first in `ACTIONS` of a hop
    response - another instance of the same class names the same `APP`,
    and the frontend would keep the poll of the app left running.
  - **The same timer again** - restated in
    [spec/actions.md](spec/actions.md#the-timer): a repeating
    `START_TIMER` identical to the running one changes nothing a backend
    or a user can tell ([VO] `evStartTimer`, `resumeRepeatTimer`).
  - **Retry** - where a frontend offers to re-send a failed request, the
    re-sent request SHOULD take the repeating timer the error ended up
    again ([SRV] `readHttp` `onRetry`, `responseError`); the backend does
    not send a running timer again for the same draft id.
  - **`SET_TITLE` in the launchpad** - new section
    [spec/actions.md](spec/actions.md#the-title) and
    [profiles/ui5.md](profiles/ui5.md#the-title-in-the-launchpad): under
    the UI5 profile inside a launchpad `SET_TITLE` also sets the shell
    title like `SET_TITLE_LAUNCHPAD`; a title that arrives before the
    shell service is ready is applied once it resolves; only a component
    that owns the page sets it ([BRW] `evSetTitle`, `ownsPage`, [LIB]
    `setShellTitle`, [COMP] `_initLaunchpad`). Not covered by the frontend
    suite, which runs no launchpad.
  - Sources: new [BRW] (`actions/Browser.js`) and [COMP] (`Component.js`);
    [CONT] names `ms_timer` / `ms_timer_sent`, [LIB] `setShellTitle`.
  - Checks: new frontend check `ui5.timer-repeat-retry` (SHOULD, UI5
    profile): a 503 on a tick, the error's Retry re-sends the same body,
    and the timer ticks again after its response. The adapter contract
    has an optional `retry()` (the `ui5` adapter presses the error
    overlay's Retry). No backend check: both backend rules are MAY, and
    the conformance apps cannot call `timer_set( )` - it is on DEV only,
    and the apps are linted against the released runtime too. Check lists
    regenerated.
  - Traffic recorded again (`traffic/node-runtime/suite.json`,
    `ui5-frontend.json`) on a runtime packed from DEV `a9c08191`
    (`@abaplint/transpiler-cli` 2.14.35 `--no-save`): only ids, ports and
    timestamps moved - the conformance apps declare no timer. The UI5 SPA
    of that commit passes every check, `ui5.timer-repeat-retry` included;
    the `bundle/webapp` of the commit before (`53140e3e`) warns on it.
    `conformance/RESULTS.md` has the run.

- **Specification revision 0.8 - the repeating timer** (2026-11-24),
  derived from abap2UI5 branch `DEV` at `4a418249`. Protocol 3 stays: an
  optional element of an existing action and a new action, no change to
  a request or to the shape of a response
  ([spec/versioning.md](spec/versioning.md#compatible-changes-within-protocol-3)).
  - **`START_TIMER` repeats.** An optional fifth element (`args[4]`, an
    ABAP boolean: `"X"`, `"true"` or `true`) repeats the timer; the
    no-busy element before it may then be `""` -
    `["START_TIMER", "TICK", "5000", "", "X"]`. A frontend arms the same
    event, delay and no-busy flag again after every applied response,
    never while a roundtrip is in flight (the rule of revision 0.7's
    kept click, [spec/transport.md](spec/transport.md#client-behaviour)),
    goes on through user events and under a popup or popover of the same
    app (through MAIN once the arming view is gone), and ends it on
    `STOP_TIMER`, on a new `START_TIMER` (which replaces it, one-shot
    without the flag), on a response that names another `APP` and on an
    error response; the UI5 frontend also on a Back/Forward restore, a
    reset and its end. One timer per frontend instance. New section
    [spec/actions.md](spec/actions.md#the-timer) ([VO] `evStartTimer`,
    `resumeRepeatTimer`, [V1] `_processAfterRendering`, [SRV] `reset`,
    `restoreFromRoute`, `responseError`, [CTX] `destroy`).
  - **New action `STOP_TIMER`** - `["STOP_TIMER"]`, no argument: cancels
    the pending tick and ends a repeating timer, nothing when there is
    none ([VO] `evStopTimer`). A follow-up action, and as a wire
    `.eF('STOP_TIMER')` (`spec/actions.md`, *Wired frontend actions*).
  - **Requests unchanged**: a tick of a repeating timer is the tick of
    revision 0.7 (`S_FRONT.TIMER: true`), noted in
    [spec/request.md](spec/request.md#the-timer-tick).
  - **Profile.** The repeat flag and `STOP_TIMER` are UI5 profile;
    portable v1 (`portable-v1.json`) is unchanged and a portable renderer
    runs a repeating timer once - new open question 16
    ([spec/open-questions.md](spec/open-questions.md#16-the-repeating-timer-in-portable-renderers)).
    `profiles/ui5.md` and `profiles/portable.md` (section 6) say so.
  - Sources: new [CTX] (`Context.js`); [VO] names `evStopTimer` and
    `resumeRepeatTimer`.
  - Checks: backend `action.timer-repeat` (new) and `ui5.frontend-wire`
    (also the wired `STOP_TIMER`); frontend, UI5 profile:
    `ui5.timer-repeat`, `ui5.timer-repeat-user-event`, `ui5.timer-stop`,
    `ui5.timer-replace`, `ui5.timer-repeat-app-change` (MUST),
    `ui5.timer-repeat-popup`, `ui5.timer-repeat-error` (SHOULD). The
    conformance app ACTIONS has the events `TIMER_REPEAT` and `TIMER_STOP`
    and a wired "Stop here" (ABAP and the cap2UI5 twin). Check lists
    regenerated; the two renderers skip the new checks (profile).
  - Traffic recorded again (`traffic/node-runtime/suite.json`,
    `ui5-frontend.json`) on a runtime packed from DEV `4a418249`
    (`@abaplint/transpiler-cli` 2.14.35 installed `--no-save` next to
    it). The UI5 SPA of that commit passes every check;
    `conformance/RESULTS.md` has the run, and a finding in abap2UI5: its
    linter release (`@abap2ui5/linter` 0.11.0) does not know `STOP_TIMER`
    yet.

- **Specification revision 0.7 - the timer tick and the pruned draft
  chain** (2026-11-24), derived from abap2UI5 branch `DEV` at `04ead8ec`
  (`880ff0a5`, `cdd2fb25`, `04ead8ec`; maintainer approved). Protocol 3
  stays: a new optional request key and a guarantee of the backend, no
  change to what a response looks like
  ([spec/versioning.md](spec/versioning.md#compatible-changes-within-protocol-3)).
  - **Request: `S_FRONT.TIMER`.** The event request of a `START_TIMER`
    tick carries `TIMER: true`, and no other request does ([VO]
    `evStartTimer`, [V1] `eB`, [SRV] `roundtrip`). New section
    [spec/request.md](spec/request.md#the-timer-tick);
    `schema/request.schema.json` admits the key (optional boolean) - the
    UI5 SPA of DEV failed `portable.timer` on the schema before.
    `profiles/ui5.md` lists `timer` among the options of the frontend's
    dispatch (no wire carries it).
  - **Draft ids: the unchanged tick.** A response to a tick whose app
    state is unchanged MAY name the id it continued (no draft written);
    every other 2xx response still names a new id
    ([spec/sessions.md](spec/sessions.md#draft-ids), [H]
    `main_end_reuse`, [CONT] `db_check_unchanged`). Open question 2 is
    resolved with that exception - polling apps wrote a draft of their
    whole state per tick.
  - **Retention.** A backend MUST hold the newest draft of a chain and the
    one before it (the retry of a lost response) and the protected ones -
    the app stack, the draft of an app-state link, the draft a route or
    app-state restore started from, every draft of an app whose app-state
    hash is active - and MAY delete the others before they expire; until
    revision 0.6 it had to hold every draft until its expiry. New section
    [spec/sessions.md](spec/sessions.md#retention) (the reference's
    `draft_keep_per_chain`, 2 by default, minimum 2: [CONT] `db_save`,
    [DR] `prune_chain`); a note in `spec/navigation.md` (*Routes*) on why
    the routes of the UI5 frontend's history survive.
  - **Client behaviour: a click that meets a tick** is kept and sent after
    the tick's response, with the id that response named (SHOULD,
    [spec/transport.md](spec/transport.md#client-behaviour); [V1] `eB`,
    `_dispatchQueuedEvent`).
  - Sources: new [CONT] (`z2ui5_cl_ui5_app_cont`) and [VO] (`ViewOps.js`).
  - Checks: backend `session.timer-tick` and `session.retention-protected`
    (new; `session.id-reuse` renamed
    in its title to what it continues - the draft before the newest);
    four window checks (`window.app-event`, `window.request-sort-filter`,
    `window.total-from-app`, `window.order-with-the-draft`) continue only
    drafts a backend must hold - against a runtime of DEV `04ead8ec` they
    failed on the pruned first draft. Frontend `request.timer-mark` and
    `transport.tick-keeps-event` (new). The backend suite's client sends
    `TIMER` with `event(..., { timer: true })`. Check lists regenerated.
  - Traffic recorded again (`traffic/node-runtime/suite.json`,
    `ui5-frontend.json`) on a runtime packed from DEV `04ead8ec`, which
    names `@abaplint/transpiler-cli` 2.14.35 (`npm install --no-save`
    next to it; `package.json` still pins 2.14.33 for the released
    1.150.0). `conformance/RESULTS.md` has the run and the findings.

- **BREAKING - protocol 3, specification revision 0.6** (2026-11-22),
  derived from abap2UI5 branch `DEV` at `1445078` (after 1.150.0; no
  release carries it yet). The maintainer broke the wire on purpose;
  [spec/versioning.md](spec/versioning.md#what-protocol-3-broke) has the
  table of what a protocol-2 implementation has to change.
  - **Response: three sections replace the two action lists.**
    `S_FRONT.S_ACTION.T_SYSTEM` and `T_CUSTOM` are gone. `S_FRONT.VIEWS`
    says what becomes of the slots - one entry per slot, a display
    `{ "XML", "OPT"? }` or a teardown `{ "DESTROY": true }`;
    `S_FRONT.NAV` is the options object the `ROUTER` action carried;
    `S_FRONT.ACTIONS` is the app's follow-up actions, entries and order
    unchanged. A section that says nothing is absent ([H]
    `response_abap_to_json`, [FE] `slots_serialize`, `nav_serialize`).
    The backend orders nothing; the frontend applies `VIEWS` in slot
    order ([V1] `_applyViews`). `spec/response.md` rewritten (*Sections*,
    *View slots*, *Processing order*), `spec/core.md`, `spec/actions.md`
    and `profiles/semantic.md` (how a response is folded) follow.
  - **One owner per teardown rule.** The backend says the teardown of
    POPUP and POPOVER for every app hop and every app start ([ACT]
    `prepare_app_stack`, `factory_first_start`); the frontend no longer
    takes them down because `S_FRONT.APP` changed. That a new MAIN view
    takes the standalone slots down is the frontend's rule alone ([SL]
    `displayMain`); the backend no longer drops a teardown next to a MAIN
    display.
  - **Request: `S_FRONT.ROUTE`.** A request without `ID` carries what the
    page's hash asks it to restore, parsed by the frontend ([RT]
    `startRoute`): `{ "APP", "DRAFT"? }` for a route, `{ "APP_STATE" }`
    for an app-state link. The backend resolves an app start from `ROUTE`
    and `SEARCH` and reads no hash structure any more ([H]
    `request_json_to_abap`); `HASH` still travels, for the app. New
    section [spec/request.md](spec/request.md#route); `spec/navigation.md`
    (*Which app a request starts*, *Routes*, *Launchpad hashes*, *The
    app-state hash*) follows - the launchpad split of a hash is the
    frontend's rule now.
  - **Navigation: "The NAV section"** replaces "The ROUTER action" in
    `spec/navigation.md`. `setPushState` / `setHashReplace` are written
    only for an app that owns the hash - a listener registered with
    `setHashEvent`, routing off - and then as the whole app hash; the
    suffix writes of the UI5 frontend are gone ([RT] `sync`).
  - **UI5 profile: the flags of an event wire are one options object**
    behind the event name - `.eB(['LIVE',{queueLast:true,noBusy:true}],
    ...)` - where they were positions [3] to [5] of the event array
    ([EV] `get_event`, [LIB] `eventOptions`). `profiles/ui5.md` (*Event
    wires*, *The options of a wire*; the window request is
    `eB(['___ZZZ_WIN', { noBusy }], ...)`).
  - **Recorded, no wire change:** the UI5 frontend keeps an event a
    control fires while its view is being built and sends it after the
    response, the first roundtrip is busy like every other, window
    requests are kept per table (`spec/response.md` *Processing order*,
    `spec/transport.md`, `profiles/ui5.md`).
  - **Open question 15 is decided: (b), protocol 3.** The app-driven
    window, which had changed the meaning of `___ZZZ_WIN` under protocol
    2, is part of protocol 3 from its first day.
  - **The offline queue is withdrawn** from the specification
    (`OFFLINE_QUEUE`, experimental in 1.149.0 and 1.150.0, removed from
    abap2UI5 with main `694fb262`): `spec/actions.md` records it as
    history, the source [OFF] is gone.
  - Schemas: `response.schema.json` (`VIEWS`, `NAV`, `ACTIONS`,
    `PROTOCOL` 3), `request.schema.json` (`ROUTE`).
  - Backend checks: `slots.order` became `slots.several`, new
    `slots.start-teardown`, `slots.hop-teardown`, `route.hash-not-read`
    (for the removed `route.launchpad-shell-hash`) and
    `ui5.event-wire-options`; the checks that read a response read the
    sections, the route checks send `ROUTE`. Frontend checks:
    `slots.app-change` is turned round (a response of another `APP` that
    names no teardown leaves POPUP and POPOVER), new `slots.order`,
    `router.start-route`, `router.start-app-state`,
    `router.no-route-on-events` and `router.hash-write-owner`; the
    scripted responses are of protocol 3 (`answer({ views, nav, actions })`
    in `conformance/frontend/lib/responses.mjs`). The backend suite's
    readers are `views( )`, `nav( )`, `actions( )`, `displayOf( )` and
    `destroys( )`; `systemActions( )`, `customActions( )` and
    `routerOptions( )` are gone from the package's exports. The check lists in
    `conformance/backend/README.md` and `conformance/frontend/README.md`
    are regenerated.
  - Conformance apps: ECHO has one more wire, `LIVE` with the flags
    queue-last and no-busy (`conformance/apps/README.md`, in the words of
    the new sections).
  - Portable profile: `actions.wire` of `profiles/portable-v1.json` names
    the sections - `views`, `navOptions`, `foldedIntoNav`, `actions`,
    `actionGlobals` (were `system`, `routerOptions`, `foldedIntoRouter`,
    `custom`, `customGlobals`); `schema/portable-profile.schema.json` and
    the generated table of `profiles/portable.md` follow.
  - Renderers: Adaptive Cards and terminal read the sections through
    `renderers/common/response.mjs` (the vendored snapshot module folds
    protocol 2); the terminal sends `ROUTE` (`startRoute` is exported)
    and writes an app's own hash only for an app that owns it.
  - Traffic: `traffic/node-runtime/` recorded again on a runtime packed
    from abap2UI5 `DEV`; `traffic/cap2ui5/` is removed until cap2UI5
    speaks protocol 3; `traffic/node-runtime/agent-client.json` is kept
    for its snapshots (`conformance/RESULTS.md`).
  - Found on the way and fixed in abap2UI5 `1445078`: every response
    carried `"O_NAV":null,"O_VIEWS":null` in `S_FRONT`.
  - Tests: an implementation that still speaks protocol 2 is *behind* -
    measured by one check, pinned (`test/lib/expected.mjs`): the released
    `@abap2ui5/node-runtime`, cap2UI5, the vendored agent client, a UI5
    checkout before protocol 3. `npm test` is green on the released
    packages and on a runtime packed from `DEV`.
  - **Who follows in this revision:** abap2UI5 `DEV` (backend, UI5
    frontend), this repository's suites, schemas, and its two renderers,
    Adaptive Cards and terminal. **Who does not, yet:** no
    `@abap2ui5/node-runtime` release speaks protocol 3 - the suites run
    against a runtime packed from abap2UI5 `DEV`; cap2UI5
    (`@cap2ui5/cds-plugin` 0.7.0 hosts a protocol-2 runtime); the agent
    client of abap2UI5/mcp-server (the copy vendored here, `332a0b0`,
    speaks protocol 2 and refuses a protocol-3 response); the Web
    Components frontend and the headless ABAP simulator were not run.
    What is pinned for them is in `conformance/RESULTS.md` and
    `test/lib/expected.mjs`.

- **Windowed tables: the app-driven window of abap2UI5 main `694fb262`**
  (#3032, after 1.150.0; derived first from the DEV branch, `186f2c9b`),
  which replaced the window of 1.149.0 and 1.150.0. The app loads, sorts,
  filters and counts the rows itself; the backend keeps no order.
  - [spec/windowed-tables.md](spec/windowed-tables.md) rewritten: `MODEL`
    carries the table as the app holds it, `/__WINDOW/<path>` is `{ TOTAL,
    COUNT, SIZE, EVENT }` with `TOTAL` the app's total read anew for every
    response and at least `COUNT` ([MOD] `window_meta`, [BND]
    `window_adopt`); the window request is `[path, event, reason, skip,
    top]`, for `SORT` and `FILTER` with the sorters and the filter groups,
    both ([WM]); the backend runs it as the app's event with the arguments
    `[reason, skip, top]` and the request in `get( )-r_event_data` ([H],
    [WIN] `request`, `parse_sort`, `parse_filter`, `count_of`); `__delta`
    rows are rows of the table and a whole table value is written. The
    sections on the backend's order, the kept and cleared parts and the
    two filters are gone; a frontend MUST NOT send a request for a state
    without `EVENT`. `spec/request.md`, `response.md`, `sessions.md`,
    `core.md`, `profiles/ui5.md` (the arguments, both parts, the
    `keepRestart` queue rule), `profiles/semantic.md` (what `app_act {
    window }` and `@BINDING_CALL` send) and `profiles/portable.md` follow;
    `spec/README.md` cites the branch and the new source [WT] (the
    release's fixture app and e2e test).
  - Protocol 2 stays, as in the branch, although
    [versioning.md](spec/versioning.md) counts a changed meaning as
    breaking - new [open question 15](spec/open-questions.md#15-the-app-driven-window-and-the-protocol-number)
    (14 is main's, resolved); open questions 12 and 13 updated.
  - Schemas: `windowRequest` is `[path, event, MORE|SORT|FILTER, skip,
    top]` plus both parts for `SORT` and `FILTER`; a window state is told
    by `SIZE` (the reference leaves a `TOTAL` or `COUNT` of 0 out) and may
    carry `EVENT`.
  - Backend checks: nine `window.*` replace fourteen - `first-window`,
    `app-event`, `request-sort-filter`, `request-bounds` (SHOULD),
    `total-from-app`, `order-with-the-draft`, `delta-rows`,
    `delta-rows-reference` (was `delta-positions-reference`),
    `whole-table-written` - 88 checks (71 MUST, 17 SHOULD). Frontend
    checks: `window.edit-row-shown` and `window.edit-row-shown-reference`
    replace `window.edit-as-delta` and `window.edit-as-delta-reference`
    (the reference one now on the recorded `MR_WIN`), `ui5.window-growth`
    and `ui5.window-sort-filter` expect the new arguments, new
    `ui5.window-no-event` - 87 checks (72 MUST, 15 SHOULD).
  - The conformance app WINDOW (ABAP, abaplint- and abap2UI5-linter-clean,
    and the cap2UI5 twin) loads its twelve rows itself and echoes what it
    was handed (`LAST`, `REQUEST`); new event `TOTAL`, the app's `SORT`,
    `FILTER` and `RERENDER` are gone. It took over the windowed table
    behind a data reference from the app REF (`MR_WIN`, event `WIN`,
    `WIN_DONE`): REF keeps `MR_TAB` and builds on every runtime.
  - Traffic recorded with the node-runtime host on a runtime built from
    `694fb262` (88 of 88 pass) and that commit's `app/webapp`; cap2ui5
    (plugin 0.7.0 on 1.149.0) fails the window checks on the app's start.
    The released hosts cannot start the app WINDOW: its eight MUST checks
    and the SHOULD `window.request-bounds` are pinned in
    `test/lib/expected.mjs` for cap2UI5, and for node-runtime when the
    installed runtime has no app-driven window (the released 1.150.0 of
    `package.json` and CI), with the place of the fix (the next abap2UI5
    release); `traffic.test.mjs` reads the pins of the recording
    (`RECORDED_FAILURES`). The node-runtime host and `npm run lint:abap`
    (now `scripts/lint-abap.mjs`) leave the app WINDOW out on such a
    runtime. The UI5 SPA's window checks are pinned in
    `test/frontend.test.mjs` when the checkout has no app-driven
    `core/WindowModel.js` (CI's `af05dce`). Outside `window.*` and the
    `WINDOW:` scenarios nothing moved; the recorder's UI5 page stand-in
    sets `ownsPage` and `ownsHash`, without which the frontend sends no
    `HASH`.
  - Finding: the agent client (mcp-server `332a0b0`) sends the window
    request of 1.149.0 and 1.150.0; the recorder marks those exchanges `malformed`,
    and `semantic.recorded-snapshots` fails on it - pinned in
    `test/frontend.test.mjs` (`conformance/RESULTS.md`).

- **node-runtime host and CI's UI5 frontend on abap2UI5 1.150.0** (1.149.0
  before). `@abap2ui5/node-runtime` 1.150.0 in the host, and the frontend
  job checks out the release commit `af05dce` it was built from. The
  release changes no protocol (draft-owner strictness, RTTI error handling,
  own apps' `_ddic.mjs`, and the frontend's row delta of a windowed table
  behind a data reference); the specification revision stays 0.5.
  node-runtime passes 93 of 93 as before; its suite traffic, recorded
  again, is identical check by check but for the page (357,791 characters,
  357,162 before), and so are the UI5 frontend's and the agent client's.
  The UI5 SPA passes 82 of 86 (4 skipped, no failure): it passes
  `window.edit-as-delta-reference` - the fix of `2cc0344` is in the
  release - and the pin in `test/frontend.test.mjs` `UI5_KNOWN_FAILS` is
  gone. The cap2UI5 host stays on `@cap2ui5/cds-plugin` 0.7.0, which pins
  the runtime 1.149.0 (92 of 93, one SHOULD warning, unchanged).
  `conformance/RESULTS.md` (*The move from 1.149.0 to 1.150.0*) and the
  README's status updated.

- **cap2UI5 host on `@cap2ui5/cds-plugin` 0.7.0** (0.6.0 before), the
  release with `t.ref( )` - a field `TYPE REF TO data` in a JavaScript
  app. The twin of `Z2UI5_CL_CONF_REF` starts now and passes
  `model.reference-delta` and `window.delta-positions-reference`, answering
  both as the ABAP app: the two pins for `cap2ui5` in
  `test/lib/expected.mjs` and both entries of `BACKEND_TRAFFIC_APART` are
  gone, `test/traffic.test.mjs` expects both checks to pass on both
  backends and compares their traffic. cap2UI5 passes 92 of 93 (one SHOULD
  warning, `error.details`), node-runtime 93 of 93. Traffic recorded again
  from both hosts; `conformance/RESULTS.md` updated (*Tables behind a data
  reference*).

- **Open question 14 resolved (b): the backend side of a table behind a
  data reference gets its checks.** A backend MUST read the entry of such
  a table at its model node `/<attr>/*` - a `__delta` there changes
  exactly the named cells, on a windowed table it names positions.
  - `spec/request.md`: the implementation note became that rule (*Checked
    by:* `model.reference-delta`, `window.delta-positions-reference`); a
    whole value at `/<attr>/*` stays an implementation note.
    `spec/windowed-tables.md` *Edits*: the positions rule names the `*`
    node. `spec/open-questions.md`: question 14 resolved.
  - New conformance app REF (`Z2UI5_CL_CONF_REF`, ABAP and cap2UI5 twin,
    `conformance/apps/README.md`): `MR_TAB` and `MR_WIN`, both
    `TYPE REF TO data`, bound dereferenced - one with `_bind( )`, one with
    `window_bind_tab( )` in the order `QTY` descending.
  - Two backend checks (MUST, core) - 93 checks (75 MUST, 18 SHOULD; 86
    core). node-runtime (`@abap2ui5/node-runtime` 1.149.0) passes both:
    its backend reads the `*` node, only its frontend sent the edit wrong.
    cap2UI5 0.6.0 cannot declare such a field in a JavaScript app; the
    twin's start fails there, and both checks are pinned for `cap2ui5` in
    `test/lib/expected.mjs` (and kept out of the traffic comparison,
    `BACKEND_TRAFFIC_APART`) until a plugin with `t.ref( )`
    (cap2UI5/cap2UI5 `5085ddc`, not released) is in the host - with it the
    twin passes both and answers as the ABAP app
    (`conformance/RESULTS.md`, *Tables behind a data reference*).
  - Suite traffic recorded again from both hosts (`traffic/*/suite.json`):
    it carries `{ "*": { "__delta" } }` requests now.

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
  - Agent client re-vendored at abap2UI5/mcp-server `332a0b0` (its
    `7f71d5f`: `buildDelta` as the fixed `buildDeltaFromPaths`; the two
    other modules unchanged). `profiles/semantic.md`: the pick of a
    selection dialog over a data reference sends that delta; the F4
    example is the re-recorded one of mcp-server (`z2ui5_cl_cgui_select`).
  - [Open question 14](spec/open-questions.md#14-tables-behind-a-data-reference-in-the-backend-suite):
    whether a backend check (and a conformance app with a data reference,
    twice) should pin the backend side.
- **The UI5 Web Components frontend is named by its new repository,**
  abap2UI5-addons/embed-webcomponent (npm `@abap2ui5/embed-webcomponent`;
  was abap2UI5/frontend-webcomponent, moved 2026-11-17). The `webcomponent`
  adapter looks for a built checkout at `../embed-webcomponent` first and
  still at `../frontend-webcomponent`, and reports the package name its
  build's `package.json` carries instead of a fixed one. The recorded runs
  in `conformance/RESULTS.md` keep the name they were made under.

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
