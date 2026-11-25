# Results

**Protocol 3** (spec revision 0.9, 2026-11-24). Backend suite, profile
`ui5` (94 checks: 86 core, 8 UI5-profile; 77 MUST, 17 SHOULD), run
2026-11-24 with `npm run conformance:node-runtime` against a runtime packed
from abap2UI5's branch DEV `a9c08191`. The traffic of this run is recorded in
[`../traffic/`](../traffic/) - against what,
[below](#what-the-traffic-is-recorded-against). What the move changed in
the suites, what it found and who has not followed yet:
[the move to protocol 3](#the-move-to-protocol-3); what revision 0.7
changed: [the timer tick and the pruned chain](#the-timer-tick-and-the-pruned-chain);
revision 0.8: [the repeating timer](#the-repeating-timer); revision 0.9:
[the timer the backend keeps](#the-timer-the-backend-keeps). The sections further
down are the record of the revisions before it, as they were written -
they speak of protocol 2, of `T_SYSTEM` and `T_CUSTOM`, and of results
that the tables here replace.

| Backend | Version | Apps | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| `node-runtime` | `@abap2ui5/node-runtime` packed from abap2UI5 DEV `a9c08191` (it names itself 1.150.0; `npm install --no-save`) - **the recorded traffic** | the ABAP apps, transpiled together with the framework by the package's `abap2ui5-transpile` (`@abaplint/transpiler-cli` 2.14.35, the version the package names, installed with it `--no-save`) | 94 | 0 | 0 | 0 | conformant (ui5) |
| `node-runtime` | `@abap2ui5/node-runtime` 1.150.0 (released, `package.json`, CI) | the same, the app WINDOW left out | - | - | - | - | **behind: protocol 2.** Not measured by this revision; `response.protocol` fails, pinned |
| `cap2ui5` | `@cap2ui5/cds-plugin` 0.7.0 on `@abap2ui5/node-runtime` 1.149.0 (the version the plugin pins), `@sap/cds` 10 | the JavaScript apps | - | - | - | - | **behind: protocol 2.** Not measured by this revision; `response.protocol` fails, pinned; no traffic recorded |

Per area, node-runtime on the DEV runtime:

| Area | Checks | node-runtime |
|---|---:|---|
| transport | 8 | 8 pass |
| response | 8 | 8 pass |
| event | 5 | 5 pass |
| model | 12 | 12 pass |
| window | 9 | 9 pass |
| message | 4 | 4 pass |
| slots | 9 | 9 pass |
| action | 4 | 4 pass |
| nav / route | 15 | 15 pass |
| session | 7 | 7 pass |
| error | 5 | 5 pass |
| ui5 | 8 | 8 pass |

The ABAP system itself (abap2UI5 on NetWeaver / ABAP Cloud) has not been run
yet - it needs a system with the apps pulled in by abapGit; the transpiled
runtime is the same framework source.

## What the traffic is recorded against

`traffic/node-runtime/` is recorded with the node-runtime host on a runtime
**packed from abap2UI5 DEV `a9c08191`** (`4a418249` in revision 0.8,
`04ead8ec` in revision 0.7, `1445078` up to revision 0.6) -
`npm run pack:node-runtime` in that checkout, `npm install --no-save` of the tgz here and
`OPEN_ABAP_CORE_DIR` at the open-abap-core of the same checkout, as
abap2UI5's own CI runs this suite - and the UI5 frontend's request code
from the same commit's `bundle/webapp` (`ui5-frontend.json`). No release
speaks protocol 3 yet. `package.json` keeps the released
`@abap2ui5/node-runtime` 1.150.0 (no unpublished version is pinned), and
`npm test` is green on both installations:

- `test/traffic.test.mjs` reads the results of the recording
  (`RECORDED_FAILURES` in [`../test/lib/expected.mjs`](../test/lib/expected.mjs):
  none), whatever is installed;
- the live backend run (`test/backends.test.mjs`, `run-conformance.mjs
  --expected`) runs the whole suite against a runtime on protocol 3 and,
  against one that is behind - the released 1.150.0, CI - the one check
  `response.protocol`, pinned as its failure (`behind( )` in
  `expected.mjs`, read off `c_protocol` of the installed package);
- the UI5 frontend the same way: the whole suite against a checkout on
  protocol 3 (`PROTOCOL` in its `core/Server.js`), `slots.main` alone,
  pinned as failed, against the release commit CI checks out;
- the app WINDOW is left out of the build and of abaplint on a runtime
  without the app-driven window, as before.

Two recordings are not of this revision:

- **`traffic/cap2ui5/` is gone.** `@cap2ui5/cds-plugin` 0.7.0 hosts a
  protocol-2 runtime; its traffic would validate against no schema here,
  and the comparison of the two backends (`test/traffic.test.mjs`) is
  skipped with that reason (`CAP_TRAFFIC_MISSING`) until `npm run record`
  runs against a plugin on protocol 3.
- **`traffic/node-runtime/agent-client.json` is kept as it was**, recorded
  on 2026-11-21 with mcp-server against a protocol-2 runtime. Its
  snapshots are the samples of `schema/snapshot.schema.json`, which
  protocol 3 did not change; its exchanges are protocol 2 and are not
  validated against the schemas of this revision (`TRAFFIC_PROTOCOL_2`).

Once a release carries protocol 3, `package.json` and CI move to it and
the conditions above find it.

## The timer tick and the pruned chain

Revision 0.7 (2026-11-24) follows two changes on abap2UI5's branch DEV
(maintainer approved): the UI5 frontend marks the request of a
`START_TIMER` tick with `S_FRONT.TIMER: true` and keeps a click that meets
a tick in flight (`880ff0a5`), and the backend answers an unchanged tick
with the id it continued and prunes every draft chain to its last two
drafts by default (`cdd2fb25`, `04ead8ec`). What they found here:

- **The UI5 SPA of DEV failed `portable.timer`** before this revision:
  its tick carried `TIMER`, which `schema/request.schema.json` refused
  (`additionalProperties: false`, and `spec/request.md` allowed no other
  key). *The spec was behind*: `TIMER` is a key of `S_FRONT` now
  ([../spec/request.md](../spec/request.md#the-timer-tick)).
- **Four window checks failed against a runtime of DEV `04ead8ec`** -
  `window.app-event`, `window.request-sort-filter`,
  `window.total-from-app`, `window.order-with-the-draft` - with
  `NO_DRAFT_ENTRY_OF_PREVIOUS_REQUEST_FOUND`: they continued the app's
  first draft after two later drafts of its chain were saved, and the
  pruning had deleted it. That was a MUST of revision 0.6 ("any draft id
  ... until the draft expires"), which the maintainer gave up for the
  draft volume: a backend now has to hold the newest draft of a chain and
  the one before it, and the protected ones
  ([../spec/sessions.md](../spec/sessions.md#retention)). *The checks
  relied on more than the spec now guarantees*: they continue only
  drafts a backend must hold, in another order, and test the same.
- New checks: backend `session.timer-tick` (a tick that changed the app
  state answers a new id, an unchanged one may answer its own, state
  carries over) and `session.retention-protected` (the draft a route
  restored and the caller on the app stack survive three more roundtrips
  - on DEV `04ead8ec` they are protected from the pruning); frontend `request.timer-mark` (`TIMER` only on a tick,
  only `true`) and `transport.tick-keeps-event` (SHOULD: a click during a
  tick goes out after the tick's response, with the id it named). The
  node-runtime host never reuses an id - its own serializer makes the
  reference's compare fail ([../spec/sessions.md](../spec/sessions.md#draft-ids)) -
  so its traffic shows the new-id branch only. The UI5 SPA of DEV, the
  Adaptive Cards and the terminal renderer pass both frontend checks.

## The timer the backend keeps

Revision 0.9 (2026-11-24) follows abap2UI5 DEV `a9c08191`, with no wire
change. An app there declares its repeating timer (`client->timer_set( )`)
and the backend sends the repeating `START_TIMER` whenever the app gets
the screen again and `STOP_TIMER` first in the response of a hop away
([../spec/actions.md](../spec/actions.md#a-timer-the-backend-keeps)); the
error overlay's Retry takes the repeating timer up again; and `SET_TITLE`
also titles the launchpad shell
([../spec/actions.md](../spec/actions.md#the-title)).

- New frontend check `ui5.timer-repeat-retry` (SHOULD, UI5 profile): a
  tick of the repeating timer meets a 503, the error overlay's Retry
  re-sends the same body, and the timer ticks again after the retried
  response. The UI5 SPA of DEV `a9c08191` passes it; the `bundle/webapp`
  of the commit before (`53140e3e`) warns ("no tick after the retried
  request's response") - the check tells the two apart. The adapter
  contract gained an optional `retry()`; the Adaptive Cards and the
  terminal renderer claim the portable profile and skip the check.
- **Not covered.** The backend rules are MAY and have no check: the
  conformance apps would have to call `timer_set( )`, which is on DEV
  only, while they are linted against the released runtime as well (and
  their cap2UI5 twin runs on 1.149.0). abap2UI5 covers them with its own
  ABAP unit tests (`ltcl_07_timer`) and the e2e test `timer-set.spec.js`.
  The shell title is not covered either: the frontend suite runs no
  launchpad; abap2UI5 covers it in `node/tests/launchpad.spec.js` and
  `browserActions.spec.js`.
- The backend suite on a runtime packed from DEV `a9c08191`: 94 pass, as
  before; traffic recorded again on it - only ids, ports and timestamps
  moved, since no conformance app declares a timer.
- **Observed in abap2UI5, resolved:** `SET_TITLE_LAUNCHPAD` is gated by
  `ownsPage` like `SET_TITLE` from DEV `bd85ca52` ([LIB]
  `setShellTitle`); the implementation note in the spec is gone.

## The repeating timer

Revision 0.8 (2026-11-24) follows abap2UI5 DEV `4a418249`: an optional
fifth element of `START_TIMER` repeats the timer - the UI5 frontend arms
the same tick again after every applied response, never while a
roundtrip is in flight - and the new action `STOP_TIMER` ends it
([../spec/actions.md](../spec/actions.md#the-timer)). Requests did not
change: a tick of a repeating timer is the tick of revision 0.7.

- The conformance app ACTIONS has the events `TIMER_REPEAT` (`["START_TIMER",
  "TICK", "500", "", "X"]`) and `TIMER_STOP` (`["STOP_TIMER"]`) and a
  button wired `.eF('STOP_TIMER')`, in ABAP and in the cap2UI5 twin. Both
  write the literal `STOP_TIMER`: `cs_event-stop_timer` is on DEV from
  `4a418249` only, and the apps are linted against the released runtime.
- New backend check `action.timer-repeat` (the empty no-busy element
  keeps its place, the stop has no argument); `ui5.frontend-wire` also
  reads the wired `STOP_TIMER`. The node-runtime packed from DEV
  `4a418249` passes both; traffic recorded again on it.
- New frontend checks, UI5 profile
  ([open question 16](../spec/open-questions.md#16-the-repeating-timer-in-portable-renderers)):
  `ui5.timer-repeat` (re-armed after every tick's response, with the id
  it named, until a response's `STOP_TIMER`), `ui5.timer-repeat-user-event`
  (no tick while a user event is in flight, the repeat goes on after its
  response), `ui5.timer-stop` (the `.eF` wire, and a stop with no timer),
  `ui5.timer-replace` (a one-shot `START_TIMER` replaces the repeat),
  `ui5.timer-repeat-app-change` (a response of another app ends it) - MUST;
  `ui5.timer-repeat-popup` (armed from a popup, it goes on after the popup
  closed) and `ui5.timer-repeat-error` (an error ends it) - SHOULD. The
  UI5 SPA of DEV `4a418249` passes all seven. Against the `bundle/webapp`
  of the commit before (`960e5d85`) `ui5.timer-repeat`,
  `ui5.timer-repeat-user-event` and `ui5.timer-stop` fail and
  `ui5.timer-repeat-popup` warns - the checks tell a frontend without the
  repeat from one with it; the three that check an end pass there, as
  they must for a timer that never repeats.
- The Adaptive Cards and the terminal renderer claim the portable
  profile and skip the seven checks; they run a repeating timer once and
  skip `STOP_TIMER` as an unknown action, as a portable v1 renderer may.
- **A finding in abap2UI5, not in the protocol:** the abap2UI5 linter of
  abap2UI5's own `package.json` (`@abap2ui5/linter` 0.11.0) reports the
  wired `STOP_TIMER` of the app ACTIONS as `unknown-frontend-action` -
  its dispatch table predates `4a418249`, while the DEV manifest
  (`.github/shared/linter-manifest.json`) lists the action. Clean with
  the next linter release that syncs the manifest.

## The move to protocol 3

abap2UI5 broke the wire on its branch DEV on 2026-11-22 (maintainer
decision; `z2ui5_if_ui5_types=>c_protocol` and `PROTOCOL` in
`core/Server.js` are 3) - what broke is listed in
[../spec/versioning.md](../spec/versioning.md#what-protocol-3-broke). This
repository followed on its own branch DEV: the specification (revision
0.6), the schemas, both suites, the conformance apps, the two renderers
and the recorded traffic. abap2UI5's CI runs both suites of this branch
against every change there (`conformance_backend`, `conformance_frontend`
in its `test.yaml`).

**The suites.** The backend suite reads `S_FRONT.VIEWS`, `NAV` and
`ACTIONS` (`views( )`, `nav( )`, `actions( )`, `displayOf( )`, `destroys( )`
in `conformance/backend/lib/client.mjs`) and sends `ROUTE` where it sent a
hash for the backend to parse. Checks that changed:

| Check | |
|---|---|
| `slots.several` (was `slots.order`) | the backend sorts nothing - MAIN and POPUP of one roundtrip each under its slot; the order is the frontend's (`slots.order` of the frontend suite) |
| `slots.start-teardown`, `slots.hop-teardown` (new) | the teardown of POPUP and POPOVER on an app start and on an app hop is the backend's to send |
| `route.hash-not-read` (new; `route.launchpad-shell-hash` is gone) | a backend resolves no app start from `HASH`; reading a launchpad hash is the frontend's parse (`router.start-route`) |
| `route.start-by-class`, `route.precedence`, `route.restore-draft`, `route.expired-draft`, `route.app-state`, `route.app-state-names-no-app` | driven with `ROUTE` |
| `ui5.event-wire-options` (new) | the flags of a wire as one options object - the app ECHO has a wire with them for it |
| frontend `slots.app-change` | turned round: a response of another app takes down what its `VIEWS` names and nothing because the name changed |
| frontend `slots.order`, `router.start-route`, `router.start-app-state`, `router.no-route-on-events`, `router.hash-write-owner` (new) | the slot order whatever the key order; `ROUTE` on an app start, parsed, never with an event; a hash of the app's own only for an app that owns the hash |

**A finding in abap2UI5, fixed.** The first recording against DEV
(`e94eaa4`) showed two keys in every `S_FRONT` that no specification
names: `"O_NAV":null,"O_VIEWS":null` - the two references that hold the
sections inside the backend, written out by the generic conversion of
the structure. Nothing failed on it (a frontend ignores unknown keys, the
schema allows them). Fixed in abap2UI5 `1445078`
(`z2ui5_cl_ui5_handler=>response_abap_to_json` writes `ID`, `APP` and
`PROTOCOL` by name); the traffic here is recorded after the fix.

**Who is behind.** Protocol 3 is in no release, and three implementations
of other repositories speak protocol 2. An implementation that is behind
is not measured by this revision - every exchange would fail on the shape
of the response - and is pinned by the one check that says so
(`test/lib/expected.mjs`):

| Implementation | Speaks | Pinned by | Follows with |
|---|---|---|---|
| `@abap2ui5/node-runtime` 1.150.0 (released) | 2 | `response.protocol` | the next abap2UI5 release |
| cap2UI5, `@cap2ui5/cds-plugin` 0.7.0 | 2 | `response.protocol`; its traffic is not recorded | a plugin that hosts that release. The twin of the app ECHO's new wire (`conformance/apps/cap2ui5/echo.js`) runs on plugin 0.7.0 and writes the flags by position there - `.eB(['LIVE',false,false,false,true,true])`, protocol 2 |
| the agent client of abap2UI5/mcp-server, vendored at `332a0b0` | 2 | `slots.main` (it refuses the response) | `lib/appclient.mjs` and `lib/snapshot.mjs` there: read `VIEWS`, `NAV`, `ACTIONS`, no teardown on an app change, the options object of a wire; then `npm run vendor:agent` and `npm run record` |
| the UI5 SPA of abap2UI5 1.150.0 (`af05dce`, CI's frontend job) | 2 | `slots.main` | CI checking out a commit on protocol 3 |
| the Web Components frontend (abap2UI5/frontend-webcomponent) | 2 | not run since 2026-10-03 | that repository |

**The renderers of this repository** (Adaptive Cards, terminal) follow in
this revision. They fold a response with a module of their own,
[`renderers/common/response.mjs`](../renderers/common/response.mjs): the
vendored snapshot module's `applyResponse` reads protocol 2 and is
byte-equal to mcp-server. The terminal renderer sends `ROUTE` and writes
an app's own hash only for an app that owns it.

## The move to the app-driven window

abap2UI5 replaced the windowed table of 1.149.0 within days of the release
and merged the app-driven one to main after 1.150.0 (`694fb262`, #3032;
derived first from the DEV branch, `186f2c9b`): the app loads, sorts,
filters and counts the rows itself, and the list binding's requests reach
it as its own event with the request in `get( )-r_event_data`
([../spec/windowed-tables.md](../spec/windowed-tables.md)). The
node-runtime host was run with a package built from that commit
([above](#what-the-traffic-is-recorded-against)), the UI5 frontend from
its `app/webapp`. What changed, as measured:

- **The other 79 checks answer as before.** Compared check by check with
  the recording of 1.150.0 (draft ids, ports, timestamps and the page's
  `ETag` normalized), the suite traffic of every check outside `window.*`
  is identical but the app REF's view, which lost its windowed table
  (below), and the page's length (350,503 characters, 357,791 in 1.150.0);
  so are the UI5 frontend's and the agent client's exchanges and
  snapshots outside the `WINDOW:` scenarios. The recorder's stand-in of
  the UI5 page now sets `ownsPage` and `ownsHash` (the backend's own page,
  `Component.js`): `core/Server.js` of `694fb262` sends `S_FRONT.HASH`
  only with `ownsHash`, and without it the two restores of the recording
  lost their hash.
- **Nine window checks replace fourteen.** The backend applies no sort
  and no filter any more and keeps no order, so the checks of the order
  (`window.sort`, `window.filter`, `window.growth-keeps-order`,
  `window.parts-kept-and-cleared`, `window.filters-anded`,
  `window.sort-last-set`, `window.count-bounds`,
  `window.unknown-path-ignored`, `window.more-rows`) are gone; what a
  backend does now is checked by `window.app-event` (the request runs the
  app as its event, `[reason, skip, top]`, `r_event_data`),
  `window.request-sort-filter` (the parsed parts), `window.request-bounds`
  (SHOULD: a request it cannot read whole), `window.total-from-app`;
  `window.delta-positions`, `window.delta-positions-reference` and
  `window.whole-table-refused` became `window.delta-rows`,
  `window.delta-rows-reference` and `window.whole-table-written`.
  `window.first-window` and `window.order-with-the-draft` stay, on the new
  app.
- **The conformance app WINDOW is app-driven** - ABAP and cap2UI5 twin
  ([apps/README.md](apps/README.md#z2ui5_cl_conf_window)). It echoes what
  it was handed (`LAST`, `REQUEST`), which is what the checks read. The
  windowed table behind a data reference moved from the app REF into it
  (`MR_WIN`, event `WIN`): with the app-driven `window_bind_tab( )` REF
  would not compile on the released runtimes, and `model.reference-delta`
  would be lost with it.
- **The released hosts cannot run it.** `@cap2ui5/cds-plugin` 0.7.0
  refuses the call `window_bind_tab( { val, total, event, window } )` -
  `no parameter "total" - { val, window, t_sort, t_filter }` - the twin's
  first `main( )` throws, and every window check ends on the app's start,
  answered `500` (78 pass, 8 fail, 2 warn). On the released
  `@abap2ui5/node-runtime` 1.150.0 the app WINDOW does not compile and is
  left out of the build; its start fails the same way. Pinned per check,
  with the place of the fix: the next abap2UI5 release after 1.150.0 (and
  a cap2UI5 that hosts it).
- **The agent client sends the window request of 1.149.0 and 1.150.0** -
  a finding ([below](#windowed-tables)).
- **The protocol number stays 2**, as on main;
  [open question 15](../spec/open-questions.md#15-the-app-driven-window-and-the-protocol-number)
  asks whether it should.

## The move from 1.149.0 to 1.150.0

Until 2026-11-20 the node-runtime host ran abap2UI5 1.149.0: 93 of 93
passed. On `@abap2ui5/node-runtime` 1.150.0 (built from the release commit
`af05dce`, transpiled by `@abaplint/transpiler` 2.14.33 like 1.149.0) the
same 93 pass, 0 fail, 0 warn. The release changes no protocol - draft-owner
strictness, RTTI error handling, own apps' `_ddic.mjs`, and in the
frontend the row delta of a windowed table behind a data reference. As
measured:

- **The suite traffic is identical** check by check with the recording of
  1.149.0 (draft ids, the version and time lines of the error bodies and
  the page's `ETag` normalized), except the page itself, which grew from
  357,162 to 357,791 characters.
- **The UI5 frontend's requests and the agent client's traffic are the
  same**: `traffic/node-runtime/ui5-frontend.json` (the frontend of
  abap2UI5 1.150.0 run in Node) and `agent-client.json` differ from the
  recording of 1.149.0 in nothing but draft ids, the measured
  `MS_CLIENT_PREV` and the host's port.
- **The UI5 SPA passes `window.edit-as-delta-reference`** - finding 3,
  fixed in `2cc0344` and released with 1.150.0; CI pins the release commit
  `af05dce` now and the pin in `test/frontend.test.mjs` is gone
  ([Frontend suite](#frontend-suite)).

The cap2UI5 host stays on `@cap2ui5/cds-plugin` 0.7.0 and with it on the
runtime 1.149.0 until a plugin release pins 1.150.0.

## The move from 1.148.0 to 1.149.0

Until 2026-11-16 the node-runtime host ran abap2UI5 1.148.0: 77 of 77
passed. What changed with the move, as measured:

- **Every check of revision 0.4 answers as before.** Compared check by
  check with the recording of 1.148.0 (draft ids, the version line of the
  error bodies and the page's `ETag` normalized), the suite traffic of the
  77 checks is identical on both hosts. The page grew from 342,499 to
  357,162 characters.
- **The UI5 frontend's requests are the same** for the scenarios recorded
  before (`traffic/*/ui5-frontend.json`, the frontend of abap2UI5 1.149.0
  run in Node): apart from the measured `MS_CLIENT_PREV` no request and no
  response differs from the recording of 1.148.0. The agent client's
  traffic and snapshots are identical too.
- **Fourteen new checks.** The thirteen of
  [../spec/windowed-tables.md](../spec/windowed-tables.md), driven through
  the new conformance app WINDOW, and
  `model.unconvertible-scalar-skipped` (SHOULD): a scalar that does not
  convert into its attribute is skipped, the roundtrip does not fail.
  Both hosts pass all fourteen. The scalar check passed on the cap2UI5
  host with plugin 0.5.0 (runtime 1.147.0) as well - the reference skipped
  such a value before 1.149.0, the release only documents it ([IC]
  `ty_s_model_skip`); the window checks need plugin 0.6.0
  ([below](#windowed-tables)).
- **New recorded scenario: the list binding of the UI5 frontend.**
  `scripts/lib/ui5-frontend.mjs` now also loads `core/WindowModel.js` of
  the checkout - on stand-ins for the two UI5 classes it extends - and
  `traffic/node-runtime/ui5-frontend.json` records what its binding sends
  when it is asked for rows past its window and told to sort and to
  filter: `["/T_ROWS","8"]`, `["/T_ROWS","4","[{\"PATH\":\"QTY\",\"DESCENDING\":true}]"]`,
  `["/T_ROWS","4","","[[[\"QTY\",\"GT\",6,null]]]"]`, then
  `["/T_ROWS","6"]` inside that order. The same requests leave a real
  browser in the frontend suite (`ui5.window-growth`,
  `ui5.window-sort-filter`).
- **The pins are per backend now.** `test/lib/expected.mjs` names the
  expected failures and warnings of each reference host;
  `scripts/run-conformance.mjs <backend> --expected` and the tests read the
  backend's own list. Both lists of failures are empty; the one warning
  pinned is `error.details` of `cap2ui5`.

What moved on the wire between the two releases is listed in
[../CHANGELOG.md](../CHANGELOG.md) and written into the spec.

## Windowed tables

**The node-runtime host passes the nine checks** of the app-driven
window ([../spec/windowed-tables.md](../spec/windowed-tables.md)) on a
runtime built from abap2UI5 main `694fb262`
([above](#the-move-to-the-app-driven-window)); on the released 1.150.0 it
cannot start the app WINDOW and fails them, pinned like cap2UI5's below.
The six `WINDOW:` exchanges of the UI5 frontend's own request code
(`traffic/node-runtime/ui5-frontend.json`, the list binding of
`core/WindowModel.js` of `694fb262`) send `["/T_ROWS","ROWS","MORE","4","4"]`,
`["/T_ROWS","ROWS","SORT","0","4","[{\"PATH\":\"QTY\",\"DESCENDING\":true}]","[]"]`,
`["/T_ROWS","ROWS","FILTER","0","4","[{\"PATH\":\"QTY\",\"DESCENDING\":true}]","[[[\"QTY\",\"GT\",6,null]]]"]`
(the sort sent along) and `["/T_ROWS","ROWS","MORE","4","2"]` inside that
order (six rows let through), and a `CHECK` with the rows 0 and 2 ticked
answers `SUMMARY` "5,2" - the rows of the table, sorted by the app.

**The cap2UI5 host fails them** - eight failures and one warning, each
on the app's start: `@cap2ui5/cds-plugin` 0.7.0 hosts the runtime 1.149.0,
whose `window_bind_tab( )` takes `val`, `window`, `t_sort` and `t_filter`,
and the plugin refuses the twin's call with `total` and `event` before it
reaches the runtime. Pinned in
[`../test/lib/expected.mjs`](../test/lib/expected.mjs) (the place of the
fix: the next abap2UI5 release after 1.150.0, hosted by cap2UI5), and kept out of
the comparison of the two recordings (`BACKEND_TRAFFIC_APART`) - both
recorders leave the `WINDOW:` scenarios out for it. The same happened
once before: plugin 0.5.0, on the runtime 1.147.0 without
`window_bind_tab( )`, failed the thirteen checks of 1.149.0 until 0.6.0
(2026-11-16). Whether windowed tables are a part every backend has to
offer stays
[open question 12](../spec/open-questions.md#12-windowed-tables-as-a-part-of-the-core-protocol).

**What the frontends do with a windowed table** (the model of
`window.first-window`: four of twelve rows, `/__WINDOW/T_ROWS` with `EVENT`
"ROWS"):

| Frontend | Rows shown | More rows, sort, filter | A cell edit |
|---|---|---|---|
| UI5 SPA, in Chromium: abap2UI5 main `694fb262` (`app/webapp`) | the rows; the growing trigger reads `[ 4 / 12 ]` | window requests of the app-driven window: `ui5.window-growth`, `ui5.window-sort-filter`, `ui5.window-no-event` pass | `__delta` of the row (`window.edit-row-shown`, `window.edit-row-shown-reference`) |
| UI5 SPA, in Chromium: abap2UI5 1.150.0 (`af05dce`, CI) | the rows, the same | **the window requests of 1.150.0** - the three `ui5.window-*` checks fail, pinned (below) | `__delta` of the row, behind a reference too |
| agent client (mcp-server `332a0b0`) | the rows, and that more are there: `rowCount` 4, `total` 12, `truncated` true, `window: { size: 4, more }` | **the window requests of 1.149.0 and 1.150.0** - a finding (below) | `__delta` of the row, behind a reference too |
| Adaptive Cards renderer | the four rows as the whole table | none; a `BINDING_CALL` wire is outside the portable profile | `__delta` of the row, behind a reference too |
| terminal renderer | the four rows as the whole table | none | `__delta` of the row, behind a reference too |
| Web Components (frontend-webcomponent main `5c52b4d`) | **not run** - read from its source only: no `__WINDOW` and no `___ZZZ_WIN` anywhere in `src/`; `growing` pages locally over the bound array (`src/render/renderer.js`), so it would show the rows as the table | none | through its vendored agent client: a `__delta` |

All five runs pass `window.rows-shown`, `window.edit-row-shown` and
`window.edit-row-shown-reference` - the last one now on the recorded
`MR_WIN` of the app WINDOW, where main's `window.edit-as-delta-reference`
was synthetic (`/MR_ROWS/*`); the UI5 SPA of 1.149.0 failed that one (a
cell behind a data reference sent whole, finding 3 below, fixed in
`2cc0344`), as the agent client did before `7f71d5f`. Besides the UI5 SPA
only the agent client tells its user that rows are missing and asks for
them - alternative (c) of
[open question 13](../spec/open-questions.md#13-windowed-tables-in-frontends-that-are-not-the-ui5-frontend),
which stays open for the other renderers; the two of this repository show
the rows as the table - no finding against a rule of this revision.

*Finding - the agent client sends the window request of 1.149.0 and
1.150.0.* mcp-server `332a0b0` (vendored; the window requests are those
of its `8efb3d7`) builds its window requests after the list binding of
1.149.0: the `@BINDING_CALL` of "Sort list" sends
`["/T_ROWS","4","[{\"PATH\":\"QTY\",\"DESCENDING\":true}]"]`,
`app_act { window: { table } }` `["/T_ROWS","8"]` and a filter
`["/T_ROWS","4","","[[[\"NAME\",\"Contains\",\"1\",null]]]"]`
(`traffic/node-runtime/agent-client.json`, recorded 2026-11-21 with a
checkout of `332a0b0`). None of them is a request of this revision
(`schema/request.schema.json`; the recorder marks them `malformed`), and
the backend hands each to the app as an event named after the count -
`LAST` reads `4 MORE 0 0` and `8 MORE 0 0` - so no row is loaded, sorted
or filtered, without an error. *The frontend is wrong* (the spec follows
the implementation that moved): the fix is in abap2UI5/mcp-server
`lib/appclient.mjs` - `[path, EVENT, reason, skip, top]` and both parts
for `SORT` and `FILTER`, the list's sorters and filter groups remembered by
the client ([../profiles/semantic.md](../profiles/semantic.md#windowed-tables)) -
then re-vendored. The frontend suite sees it in
`semantic.recorded-snapshots`, whose replay of the "Sort list" press posts
such a request: it fails on the request schema, pinned in
`test/frontend.test.mjs` (`AGENT_KNOWN_FAILS`); its snapshots still
match the recording. The suite cannot drive `app_act { window }` through
the adapter interface, which has no "more rows" - the `ui5.window-*`
checks are the UI5 profile's and skip the agent client.

## Tables behind a data reference

[Open question 14](../spec/open-questions.md#14-tables-behind-a-data-reference-in-the-backend-suite),
resolved (b): a table bound through a data reference is the model node
`/<attr>/*`, and a backend MUST read its `__delta` there
([../spec/request.md](../spec/request.md#the-model-delta)). The
conformance app REF (`Z2UI5_CL_CONF_REF`) binds `MR_TAB` with `_bind( )`;
the windowed `MR_WIN`, in its own order (`QTY` descending), was REF's
until 2026-11-21 and is the app WINDOW's since the app-driven window
([above](#the-move-to-the-app-driven-window)), its check renamed
`window.delta-rows-reference`. The two checks send `{ "MR_TAB": { "*": { "__delta": { "1":
{ "TEXT": "zwei", "DONE": true } } } } }` and `{ "MR_WIN": { "*": {
"__delta": { "0": { "DONE": true }, "2": { "DONE": true } } } } }` with
`CHECK`. Measured 2026-11-19 to 2026-11-21:

| Backend | `model.reference-delta` | `window.delta-positions-reference` (1.149.0 window) / `window.delta-rows-reference` (app-driven) |
|---|---|---|
| `node-runtime` 1.149.0, 1.150.0 | pass - exactly row 2 changed, `SUMMARY` `1:one:,2:zwei:X,3:three:` (with a `;` and `MR_WIN`'s rows until 2026-11-21) | positions: pass - positions 0 and 2 land in the rows with `ID` 4 and 5; rows: fail, pinned - the app WINDOW does not compile on 1.150.0 |
| `node-runtime` on main `694fb262` | pass | rows: pass - rows 0 and 2 are the rows with `ID` 4 and 5, `WIN_DONE` `4,5`; a `MORE` on `/MR_WIN/*` appends `6`, `3` and keeps the edit |
| `cap2ui5` 0.6.0 (until 2026-11-20) | fail, was pinned - the start answers `500` | fail, was pinned - the same |
| `cap2ui5` 0.7.0 (`t.ref( )`) | pass - as node-runtime | positions: pass; rows: fail, pinned - the app WINDOW does not start |

*node-runtime.* The spec recorded as an implementation note that the
1.149.0 backend applies the `*`/`__delta`, and that only the 1.149.0
frontend sent it wrong (the whole attribute, [Frontend suite](#frontend-suite), finding 3
of the UI5 SPA; fixed in abap2UI5 2cc0344, #3026). Verified against the
runtime the suite uses, `@abap2ui5/node-runtime` 1.149.0: [MOD]
`main_json_to_attri` reads every entry at the attribute's client name,
`/MR_TAB/*`, applies a `__delta` there by row and maps a windowed one
through its order (`delta_apply_to_table` with the window). No pin.

*cap2UI5.* A JavaScript app of `@cap2ui5/cds-plugin` 0.6.0 declares its
fields as strings, numbers, booleans, structures and tables - there is no
field `TYPE REF TO data`, and a box the app made itself would neither bind
dereferenced nor survive the draft. The twin
[`apps/cap2ui5/ref.js`](apps/cap2ui5/ref.js) therefore needs `t.ref( )`:
on a plugin without it the app is registered as one whose `main( )` throws
(a declaration with `t.ref( )` would throw while the module loads and take
every app of the host with it), so on 0.6.0 the start of
`Z2UI5_CL_CONF_REF` was answered `500`, both checks ended on that first
request and were pinned, and `BACKEND_TRAFFIC_APART` kept them out of the
comparison. Filed for cap2UI5 and released in `@cap2ui5/cds-plugin` 0.7.0:
`t.ref( )` - a field `TYPE REF TO data`, read and written as the data it
points to, bound as `"mr_tab->*"` with `_bind( )` and
`window_bind_tab( )`, kept in the draft by the framework's own S-RTTI. The
host runs 0.7.0 since 2026-11-20: the twin passes both checks and answers
them as the ABAP app (compared in the recorded traffic); the suite ends
92 pass, 1 warn (`error.details`). The two pins and
`BACKEND_TRAFFIC_APART` are gone.

## The move from 1.146.0 to 1.148.0

Until 2026-11-15 both hosts ran abap2UI5 1.146.0 (`@abap2ui5/node-runtime`
1.146.0; `@cap2ui5/cds-plugin` 0.4.0 on it): 75 and 74 of 76 passed, with
`error.no-reflection` failing on both and pinned. What changed with the
move, as measured:

- **`error.no-reflection` passes on both** - the one result that changed.
  The pin in [`../test/lib/expected.mjs`](../test/lib/expected.mjs) is
  removed ([next section](#the-request-url-reflected-into-the-error-body)).
- **Every other check answers as before.** Compared check by check with the
  recording of 1.146.0 (draft ids, ports and the page's `ETag` normalized),
  the suite traffic differs only in the version line of the error bodies,
  the URL in them (stripped now), and the size of the page (377,059 ->
  342,499 characters: the developer tools left the page for a bundle of
  their own, `GET ?z2ui5-bundle=devtools`,
  [../profiles/ui5.md](../profiles/ui5.md#the-page)).
- **The UI5 frontend's requests are the same** for the recorded scenarios
  (`traffic/*/ui5-frontend.json`, the frontend of abap2UI5 1.148.0 run in
  Node): apart from the measured `MS_CLIENT_PREV` no request and no
  response differs from the recording of 1.146.0. The agent client's
  traffic and snapshots are identical too.
- **The node-runtime host is built differently.** From 1.148.0 on the
  package's recipe for a host's own classes is one transpile of the
  framework and the classes (`abap2ui5-transpile`) into a runtime of the
  host's own, imported through its `host.mjs`; loading
  `apps/index.mjs` next to the package's `output/` is deprecated.
  `conformance/hosts/node-runtime/` follows the new recipe, with the
  transpiler the package names (2.14.5).
- **The node-runtime host answers the suite with its Host/Origin guard
  off.** From 1.147.0 on `serve()` refuses a request with a foreign
  `Origin` itself - 403, `text/plain`, no `nosniff`, a body of its own
  (`srv/hostguard.mjs`) - before the framework's CSRF gate sees it.
  `transport.csrf-origin` passes either way (it asks for the 403), but
  with the guard on it no longer tests the framework. The suite runs and
  the recorder start the host with `allowedHosts: "*"`, on a loopback
  port that lives for the run, so that the gate of
  [../spec/transport.md](../spec/transport.md#csrf-and-origin) is what
  answers and what `traffic/` records, as on cap2UI5 (which mounts the
  unguarded handler). `npm run serve:node-runtime` keeps the guard.
- **New check `route.app-state-names-no-app`** (SHOULD): an app-state hash
  restores its draft when the request names no class, and a draft that is
  gone ends on the start app with a toast - behaviour of abap2UI5 from
  1.147.0 on ([../spec/navigation.md](../spec/navigation.md#the-app-state-hash));
  both hosts pass. It was not run against 1.146.0; from the source
  ([H] `main_begin` of `2a55c9f`) that release answers such a request with
  the start app and would warn.

What moved on the wire between the two releases without changing a result
is listed in [../CHANGELOG.md](../CHANGELOG.md) and written into the spec.

## The request URL reflected into the error body

`error.no-reflection` (MUST since revision 0.3) starts an unknown app with
`<script>`, `<img>` and quotes in the request URL and requires the 500 body
not to contain them verbatim. Up to abap2UI5 1.146.0 both reference
backends failed it, identically:

```
Request failed, no event (initial rendering), app_start Z2UI5_CL_CONF_DOES_NOT_EXIST,
url /?app_start=Z2UI5_CL_CONF_DOES_NOT_EXIST&conformance=<script>alert("conformance-probe")</script><img src='conf...
```

The class name was stripped to name characters ([ACT] `app_start_safe`),
the URL was not ([H] `request_context_info`). *The backend was wrong* (the
maintainer's decision on
[open question 3](../spec/open-questions.md#3-the-request-url-reflected-into-the-error-body));
abap2UI5 fixed it in `72c86cc`, released with 1.147.0: the URL is stripped
to letters, digits and `/ ? & = . _ - ~ : % +` ([H]
`context_info_url_safe`). Both hosts now answer

```
Request failed, no event (initial rendering), app_start Z2UI5_CL_CONF_DOES_NOT_EXIST,
url /?app_start=Z2UI5_CL_CONF_DOES_NOT_EXIST&conformance=scriptalertconformance-probe/scriptimgsrc=conformance-probe
```

and pass. The pin in [`../test/lib/expected.mjs`](../test/lib/expected.mjs)
is removed; the recorded traffic carries the pass (`counts.fail` 0 on
both).

## Differences between the two backends

`test/traffic.test.mjs` compares the two recordings check by check - status,
media type and JSON body, draft ids normalized - and finds them
**identical** apart from the following - and apart from the nine checks
of the [windowed tables](#windowed-tables), which the cap2UI5 host fails on
the app's start and the comparison leaves out while they are pinned
(`BACKEND_TRAFFIC_APART` in `test/lib/expected.mjs`); the check of the app
REF ([above](#tables-behind-a-data-reference)) is compared. Both are the same framework
(cap2UI5 hosts `@abap2ui5/node-runtime` rather than porting it), so this
was the expected outcome; what differs is what the host adds around it.

1. **Error body of a JavaScript app's exception** - *filed difference,
   within the spec.* A `throw` in a cap2UI5 JavaScript app is no ABAP
   exception: it passes the framework's `CATCH cx_root` and reaches the
   plugin's own catch, which answers `500 text/plain` with
   `roundtrip failed (<correlation id>)` and logs the cause server-side
   (cap2UI5 `plugin/cds-plugin.js`, `roundtrip`). Status, media type and the
   draft handling are the framework's (`error.app-exception`,
   `session.failed-roundtrip-not-persisted` pass); only the body text names
   nothing, so `error.details` (SHOULD) warns.
   *Spec decision:* the content of an error body is not normative
   ([../spec/errors.md](../spec/errors.md#the-error-response)); naming the
   failure is a SHOULD with "MAY hide details on purpose", which is exactly
   the reference's own `check_hide_error_details`. *Filed for cap2UI5:* the
   masking is deliberate (no reconnaissance for clients), but it differs from
   the framework's errors on the same route (an unknown draft shows the
   framework's full body) - a project setting, or the user exit's
   `check_hide_error_details`, could decide both the same way.
2. **`Content-Type` charset spelling of that body** - `text/plain;
   charset=utf-8` (cap2UI5, express) vs `text/plain; charset=UTF-8`
   (framework). Media types are case-insensitive in their parameters; not a
   difference the spec cares about.

## Spec decisions taken while running the suite

Places where the implementations made a choice the specification now
records - as a rule, or as an implementation note:

- **Only bound attributes are the model.** The called app's `MODEL` holds
  `INPUT`/`OUTPUT`, not the unbound `HAS_PREV` - normative
  ([../spec/response.md](../spec/response.md#model)).
- **An app that binds nothing sends no `MODEL`, even with a display** -
  normative exception to "a display carries the model".
- **Draft ids repeat after `nav_app_leave`.** Leaving twice to the same
  caller answered the same id twice - implementation note; a frontend must
  not assume uniqueness ([../spec/sessions.md](../spec/sessions.md#draft-ids)).
- **An earlier draft id continues from its own snapshot** - normative
  (retry safety, [../spec/sessions.md](../spec/sessions.md#drafts-are-snapshots)).
- **Unknown draft on an event = error; on a route = fresh start + toast** -
  normative, both behaviours of the reference.
- **The request URL is reflected unescaped into the 500 body** - recorded
  as an implementation note in revision 0.1 (safe only as `text/plain` +
  `nosniff` + a frontend that renders text); since revision 0.3 a backend
  MUST NOT reflect unvalidated request data (`error.no-reflection`, above;
  [../spec/errors.md](../spec/errors.md#the-error-response)), and since
  abap2UI5 1.147.0 the reference does not.
- **An app-state hash names the app** - normative since revision 0.4
  (SHOULD, `route.app-state-names-no-app`), the behaviour of the reference
  from 1.147.0 on.
- **`DEFAULT` routing mode on every hop to an app without a mode** -
  normative ([../spec/navigation.md](../spec/navigation.md#the-nav-section)).
- **Event argument conversion** (`true` -> `X`, `null`/`false` -> empty,
  objects -> compact JSON text) - normative, the same on both backends.

## Frontend suite

Frontend suite, 102 checks (83 MUST, 19 SHOULD; 76 core, 8 portable, 15 UI5,
3 semantic), run 2026-11-24 for protocol 3 (revision 0.9) against the
traffic recorded from a runtime packed from abap2UI5 DEV `a9c08191` - the
UI5 SPA of that commit, the Adaptive Cards and the terminal renderer - with
`abap2ui5-conformance frontend --adapter <name>` (each frontend at its
widest profile). The scripted backend answers from
[`../traffic/node-runtime/`](../traffic/node-runtime/) plus synthetic edge
cases. A skip is no verdict: outside the profile, a capability the
frontend does not have (a URL, a DOM, timers), or an interaction it cannot
perform. The paragraphs below the table are the record of the revisions
before protocol 3.

| Frontend | Version | Profile | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| UI5 SPA (`ui5`) | abap2UI5 DEV `a9c08191` `bundle/webapp` (protocol 3), OpenUI5 1.153.0 (npm), Chromium 156 | ui5 | 98 | 0 | 0 | 4 | conformant (ui5) |
| UI5 SPA (`ui5`) | abap2UI5 1.150.0 `app/webapp` (release commit `af05dce`, which CI pins) | ui5 | - | - | - | - | **behind: protocol 2** - `slots.main` fails, pinned ([above](#the-move-to-protocol-3)) |
| agent client (`agent`) | abap2UI5/mcp-server `lib/appclient.mjs` @ `332a0b0` (vendored - `adapters/vendor/mcp-server/source.json`) | semantic | - | - | - | - | **behind: protocol 2** - it refuses every response of this revision; `slots.main` fails, pinned. Its last result on protocol 2: 63 pass, 1 fail, 23 skip |
| Adaptive Cards renderer (`adaptive-cards`) | [`renderers/adaptive-cards/`](../renderers/adaptive-cards/README.md) of this repository (prototype), Adaptive Cards 1.5 | portable | 72 | 0 | 0 | 30 | every check it can be driven through holds |
| terminal renderer (`terminal`) | [`renderers/terminal/`](../renderers/terminal/README.md) of this repository, driven with keys through its state machine | portable | 82 | 0 | 0 | 20 | every check it can be driven through holds, the router checks included |
| Web Components (`webcomponent`) | abap2UI5/frontend-webcomponent 0.1.0, `dist/` built from main `410d607` (PR #2) - run 2026-10-03, against the 1.146.0 recording | portable | 68 | 0 | 0 | 13 | protocol 2, not run for this revision; then conformant (portable) in 3 of 4 runs, `model.number-and-boolean` intermittent (below) |
| headless ABAP simulator (`headless`) | - | - | - | - | - | - | not drivable: in-process, no HTTP seam ([frontend/README.md](frontend/README.md#adapters)) |

The UI5 SPA run is stable (two consecutive runs, identical results) and
takes about two minutes; `test/frontend.test.mjs` pins the UI5, the agent,
the Adaptive Cards and the terminal result check by check. Until 2026-10-10
CI pinned abap2UI5 `5d7e91f` (`app/webapp` as at `b812079`, 1.146.0), where
the UI5 SPA failed `portable.box-details` (finding 1 below; 76 pass, 1 fail,
4 skip, with OpenUI5 1.144.0 and 1.153.0 alike). abap2UI5 fixed it on main in
`72c86cc` (open question 7, decided: expanded); CI pinned a main that
carried the fix (`1bbb9d4`), and the pin is gone - every MUST holds, 77
pass, 4 skip.

Since 2026-11-15 CI pins the release commit of abap2UI5 1.148.0
(`610d9ae`), the frontend `@abap2ui5/node-runtime` 1.148.0 ships: the same
77 pass, 0 fail, 0 warn, 4 skip, check by check, in two consecutive runs.
Nothing the suite checks moved in the frontend between `1bbb9d4` and the
release. `request.config-cadence` was made exact on the way: it counted a
static block in an event request as repeated even when no earlier request
had carried it, and from 1.147.0 on the UI5 frontend sends `S_UI5` alone
with the first request that finds it loaded
([../spec/request.md](../spec/request.md#config-the-session-block)) -
*the check was imprecise*; it now flags only a block the backend already
has. In the suite's page `S_UI5` is loaded before the first request, so
the SPA's result did not depend on it.

Since 2026-11-16 CI pins the release commit of abap2UI5 1.149.0
(`6f55b04`), the frontend `@abap2ui5/node-runtime` 1.149.0 ships: the 77
checks of before pass as before, and the four new ones pass -
`window.rows-shown`, `window.edit-as-delta`, `ui5.window-growth` and
`ui5.window-sort-filter` ([above](#windowed-tables)): 81 pass, 0 fail, 0
warn, 4 skip, in two consecutive runs. The last two drive a real growing
`sap.m.Table` over the recorded answers of the conformance app WINDOW: a
click on its "More" trigger and two `BINDING_CALL` buttons. The 86th,
`window.edit-as-delta-reference`, failed (finding 3).

Since 2026-11-20 CI pins the release commit of abap2UI5 1.150.0
(`af05dce`), the frontend `@abap2ui5/node-runtime` 1.150.0 ships: 82 pass,
0 fail, 0 warn, 4 skip - the 81 of before, and
`window.edit-as-delta-reference`, whose pin is removed. Every MUST holds.

On 2026-11-21, with the checks of the app-driven window
([above](#the-move-to-the-app-driven-window)), the SPA of abap2UI5 main
`694fb262` (`app/webapp`) passes 83, 0 fail, 0 warn, 4 skip -
`window.edit-row-shown` and `window.edit-row-shown-reference` in place of
the two `edit-as-delta` checks, the two `ui5.window-*` checks with the new
arguments, and `ui5.window-no-event` (a window state without `EVENT`
sends nothing). The release 1.150.0 CI pins (`af05dce`) passes 80 and
fails those three `ui5.window-*`: its list binding sends
`["/T_ROWS","8"]` and `["/T_ROWS","4",<sort>]`, and sends for a state
without `EVENT` too. `test/frontend.test.mjs` pins the three for a
checkout whose `core/WindowModel.js` has no app-driven window (no
`REASON`) and none for one that has; the place of the fix is
`694fb262`, the next release after 1.150.0.

### Findings - the UI5 SPA

1. **Message box details are not shown on OpenUI5 >= 1.120** -
   `portable.box-details`, MUST; *the frontend is wrong* (fixed in abap2UI5
   `72c86cc`, after 1.146.0). A
   `MESSAGE_BOX` with `details` shows the text and an empty details area.
   Evidence (OpenUI5 1.144.0): the box's VBox holds `Text` (visible),
   `Link "View Details"` (hidden), `MessageStrip "Details could not be
   loaded."` (hidden), `FormattedText` (visible, `htmlText` empty).
   abap2UI5 `app/webapp/core/actions/ControlCall.js` `expandBoxDetails`
   makes the `FormattedText` visible and hides the link - but
   `sap.m.MessageBox` sets the details text only in the link's press handler
   (`showDetails`, 1.144.0 `MessageBox.js` line 249; the same in 1.120.0),
   while 1.71.80 set it when creating the control
   (`new FormattedText().setVisible(false).setHtmlText(mOptions.details)`).
   So the expansion works on 1.71 and leaves the details unreachable on
   every release since the lazy fill - including the 1.144.0 the abap2UI5
   e2e suite pins. Fix belongs in `expandBoxDetails` (set the sanitized
   details as `htmlText` itself, or press the link). Spec: details are shown
   with the box ([../spec/actions.md](../spec/actions.md#messages);
   alternative in [open question 7](../spec/open-questions.md#7-message-box-details-shown-or-behind-a-link)).
2. **An unknown control fails the view** - `portable.unknown-control`;
   *the spec was wrong.* `<x:Gadget xmlns:x="com.example.conformance"/>`
   ends in `ModuleError: failed to load 'com/example/conformance/Gadget.js'`
   and the fatal overlay. The portable profile called the UI5 frontend "a
   portable frontend by construction", which would require a placeholder;
   but in the UI5 profile every UI5 element is in the vocabulary and one that
   does not load is a failed view (and the frontend's SDK hint depends on
   that). The profile now says the UI5 frontend renders every portable app
   and binds the tolerance rule to the other renderers; the check skips a
   UI5-profile frontend ([open question 6](../spec/open-questions.md#6-the-ui5-frontend-and-the-portable-tolerance-rule)).
3. **A cell of a windowed table behind a data reference is sent whole** -
   `window.edit-as-delta-reference`, MUST; *the frontend was wrong* (fixed
   in abap2UI5 `2cc0344`, #3026, released with 1.150.0; pinned in
   `test/frontend.test.mjs` `UI5_KNOWN_FAILS` while CI pinned the 1.149.0
   release commit, unpinned with the move to 1.150.0). The cell path is `/MR_ROWS/*/2/DONE`; `buildDeltaFromPaths`
   took the `*` for an unknown shape and sent
   `{ "MR_ROWS": { "*": [ ...the four rows... ] } }`, which the backend
   refuses for a windowed table ([MOD] `main_json_to_attri`) - the edit
   was lost; abap-cloud-gui's value help (a `TableSelectDialog` over such a
   table) picked nothing. The fixed frontend sends the `__delta` on the
   `*` node and passes (run against abap2UI5 `1854bf4`, 2026-11-18).

Everything else holds in the browser, with real controls: the envelope,
ID continuation (also an id seen before), raw JSON event arguments (`true`
stays `true`), the delta rules (whole scalars and structures, `__delta`
rows, nested `__delta`, the whole value beating a delta, the popup's own
model, no delta for pushed values, edits typed during a roundtrip kept), the
CONFIG cadence, `sap-contextid` kept, the CSRF handshake, no retry of a
500, one roundtrip at a time, the queue-last wire, PROTOCOL 3 refused
naming both numbers, unknown keys ignored, every slot rule including the
teardown on an APP change, model pushes only into the answering app's
slots, follow-up actions in order after rendering, an unknown action
skipped and logged, the box close event with the pressed action, the hash
under KEEP, Back restoring the caller's route, the app-state hash, and an
error body shown verbatim as text.

### Findings - the agent client

Re-vendored at abap2UI5/mcp-server `a4d9f07` (main, PR #44), and again at
`82b75d8` (its #48 and #49; the commit `adapters/vendor/mcp-server/source.json`
names - this page and the README named `a4d9f07` until revision 0.5, which
the vendored copy had left with this repository's #5), and on 2026-11-17 at
`8efb3d7` (its #71: windowed tables): every check that applied passed -
63 pass, 0 fail, 0 warn, 22 skip, two runs identical, the same counts as at
`82b75d8` (61 and 20 before the four checks of the windowed tables, two of
which are the UI5 profile's). On 2026-11-18 at `332a0b0` (its `7f71d5f`:
the row delta behind a data reference, as abap2UI5 #3026): 64 pass, 22
skip - `window.edit-as-delta-reference` passed, and failed with `8efb3d7`,
which sent the whole attribute like the UI5 frontend of 1.149.0. **With
the app-driven window (2026-11-21) one fails:** 63 pass, 1 fail, 0 warn,
23 skip. `semantic.recorded-snapshots` replays the recorded
`@BINDING_CALL`, and the request the client posts for it is the window
request of 1.149.0 and 1.150.0 - no request of this revision
([above](#windowed-tables)); pinned in `test/frontend.test.mjs` with the
place of its fix (abap2UI5/mcp-server `lib/appclient.mjs`). Of the other
frontend checks of the windowed tables, `window.rows-shown`,
`window.edit-row-shown` and `window.edit-row-shown-reference` pass; the
three `ui5.window-*` skip (UI5 profile). `semantic.snapshot-schema`
validates the snapshot of a windowed table. The five MUST deviations and
three warnings measured at
`ea4e9fa` (revision 0.2) are fixed in the client, as filed:

1. PROTOCOL check - a `PROTOCOL: 3` response is refused naming both numbers
   (`response.protocol-mismatch`, `-message`).
2. `sap-contextid` read and sent back (`transport.contextid-kept`; open
   question 9, decided: MUST).
3. One roundtrip at a time - a second `act` on a session in flight is
   queued (`transport.one-at-a-time`; open question 8, decided: the client
   queues).
4. POPUP/POPOVER torn down on an `APP` change (`slots.app-change`).
5. The error body verbatim, no markup stripped (`error.as-text`).

and the CSRF token handshake (`transport.csrf-token`) and edits made during
a roundtrip kept (`model.pending-survive-push`). Skipped: the portable and
UI5 profiles (not claimed), the URL, DOM and focus checks (no browser), a
nested-table cell (the snapshot does not describe nested tables), a
programmatic model edit. `traffic/*/agent-client.json` was recorded again
on 2026-11-16 with a checkout of the vendored commit (`82b75d8`) against
both hosts; its exchanges and snapshots are identical to
the recording of `ea4e9fa` but for the draft ids. On 2026-11-17 it was
recorded with `8efb3d7` (`git archive` of the vendored commit): the nine
exchanges and snapshots of before are identical but for the draft ids,
and four of the windowed table follow ([above](#windowed-tables)); and
`semantic.recorded-snapshots` passes against it. On 2026-11-21 it was
recorded again from a checkout of `332a0b0` against the node-runtime host
on a runtime of abap2UI5 main `694fb262`: the nine exchanges and snapshots of before are
identical but for the draft ids, the three window requests are marked
`malformed` ([above](#windowed-tables)); against the cap2UI5 host the
`WINDOW:` scenario is left out (the app does not start there).

### Findings - the Adaptive Cards renderer

A renderer that is not a browser, run in process
([../renderers/adaptive-cards/](../renderers/adaptive-cards/README.md)):
the card host speaks the protocol to the scripted backend, each answer is
rendered into an Adaptive Card 1.5 and the suite reads the card; a "press"
submits what a card host submits - the action's data merged with every input
value, ids being binding paths - and the renderer turns that back into the
request. All 66 checks that apply pass, two runs identical: the envelope,
ID continuation, raw event arguments (model arguments re-read after the
edits of the same submit), every delta rule including nested `__delta`
rows (the edits are found by comparing the submitted values with the model
the card was rendered from), `sap-contextid`, the CSRF handshake, no retry
of a 500, one roundtrip at a time (a submit in flight queues the next, open
question 8), PROTOCOL 3 refused, the slot rules (popup modal, popover not:
a press in MAIN closes it, as UI5 does), the NEST placeholder, toasts,
boxes (their details shown expanded, as text) and their close event,
START_TIMER, an unknown and an excluded
follow-up action skipped and logged, the tolerance rule (an unknown control
becomes a placeholder and an `unsupported` entry), and an error body shown
verbatim (a `TextRun`, not markdown). Skipped: a URL (routing, Back, the
app-state hash), a DOM (the sanitizer probe), focus, a document title and
programmatic model edits; the UI5 and semantic profiles are not claimed.
(`portable.box-details` asked for a DOM until 2026-10-04 and was skipped;
it reads only the text on screen, which every adapter reports, and now
runs - see the terminal renderer below.)
Every golden card also validates with the Adaptive Cards JavaScript SDK
3.0.6 (`AdaptiveCard.parse` + `validateProperties`, no issue; run by hand,
not a dependency).

Found on the way, *the spec held*: nothing in the portable profile needed
a browser to be rendered; what a card cannot do (raise `change` events,
show a URL) the profile already lets a renderer drop or the edit travels
with the next action.

### Findings - the terminal renderer

A renderer for a text terminal, run in process
([../renderers/terminal/](../renderers/terminal/README.md)): its session
speaks the protocol to the scripted backend, and the adapter drives its
state machine the way a user drives it - `fill` Tabs to the field bound to
the path and types the value (Ctrl+U, the characters, Tab to commit),
`press` Tabs to the action raising the event and presses Enter, `back` is
Alt+Left; the state is read from the screen (a layer per slot, the bound
fields' values). All 72 checks that apply pass, five runs identical: the
envelope, ID continuation, raw event arguments, every delta rule
including nested `__delta` rows (the edits are the committed fields' paths,
as in the UI5 frontend - an edit typed and typed back is none),
`sap-contextid`, the CSRF handshake, no retry of a 500, one roundtrip at a
time (queued), PROTOCOL 3 refused, the slot rules, the NEST placeholder,
toasts, boxes with their details expanded and their close event,
START_TIMER, SET_FOCUS (the focus moves to the widget with that id after
the views are built), SET_TITLE, an unknown and an excluded follow-up
action skipped and named in the status line, the tolerance rule, an error
body shown verbatim - and, unlike the card, the four router checks: the
renderer keeps the hash a browser would show and its history, synchronised
once per response like the UI5 router, sends it as `HASH` and restores the
caller's route on Back with an app-start-shaped request. Skipped: a DOM
(the sanitizer probe - the terminal's own sanitizing, every control
character a backend sends replaced before it reaches the terminal, is
tested in `test/terminal.test.mjs`), a programmatic model edit
(`model.whole-beats-delta`: a user cannot type a whole table); the UI5 and
semantic profiles are not claimed. `test/backends.test.mjs` also drives it
against the node-runtime host (BIND, ROUTE with Back, NAV, `--print`).

Found on the way:

1. **`portable.box-details` asked for a DOM but reads only the text on
   screen** - *the suite was wrong.* The check needs no capability: the
   text is part of every adapter's normalized state. It now runs for every
   portable frontend; the Adaptive Cards renderer and the terminal pass it
   (the UI5 SPA's result is unchanged - it has a DOM).
2. *The spec held* for a frontend with a hash but no browser: the router
   rules (spec/navigation.md) are written against the URL hash, and a
   history kept in memory satisfies all of them; nothing in the portable
   profile needed a browser. Where a terminal has no counterpart (a URL to
   open, a file to download) the profile's MAY-be-a-no-op already covers
   it - the terminal names the URL in its status line.

### Findings - the Web Components frontend

Run against `dist/` built from its main `410d607` (PR #2: `ROUTER` and the
URL hash, verbatim error text, formatters, growing), in a separate worktree
(`WC_FRONTEND_HOME`): 68 pass, 0 fail, 0 warn, 13 skip in three of four full
runs - every portable-profile check that applies, now including the router
checks and `error.as-text`. In the other run, and in one of three runs of
the check alone, **`model.number-and-boolean` failed**: the edited
`StepInput` (`/QTY`, 42) was missing from `MODEL` - the press reached the
frontend before the `ui5-step-input` had committed the typed value.
Intermittent, not yet attributed (the adapter fills the inner input,
presses Enter and blurs, then waits 50 ms; a longer wait did not make it go
away); filed for abap2UI5/frontend-webcomponent. Skipped: the UI5 and
semantic profiles, `message.box-close-event` (the box close is not wired in
the adapter), the focus and model-edit checks, and three table-cell checks
(its DOM exposes control ids, not binding paths). Its vendored copy of the agent client is being
re-pinned to `a4d9f07` there as well.
