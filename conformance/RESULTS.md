# Results

Backend suite, profile `ui5` (77 checks: 70 core, 7 UI5-profile; 62 MUST,
15 SHOULD), run 2026-11-15 with `npm run conformance:<backend>`. The traffic
of these runs is recorded in [`../traffic/`](../traffic/). Revision 0.4
moved both reference hosts to current releases and added
`route.app-state-names-no-app` (SHOULD); no failure is pinned any more -
see [below](#the-request-url-reflected-into-the-error-body).

| Backend | Version | Apps | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| `node-runtime` | `@abap2ui5/node-runtime` 1.148.0 (abap2UI5 1.148.0, transpiled) | the ABAP apps, transpiled together with the framework by the package's `abap2ui5-transpile` (`@abaplint/transpiler-cli` 2.14.5) | 77 | 0 | 0 | 0 | conformant (ui5) |
| `cap2ui5` | `@cap2ui5/cds-plugin` 0.5.0 on `@abap2ui5/node-runtime` 1.147.0 (the version the plugin pins), `@sap/cds` 10 | the JavaScript apps | 76 | 0 | 1 | 0 | conformant (ui5), one SHOULD warning: `error.details` (below) |

Per area (both backends identical except `errors`):

| Area | Checks | node-runtime | cap2ui5 |
|---|---:|---|---|
| transport | 8 | 8 pass | 8 pass |
| response | 8 | 8 pass | 8 pass |
| event | 5 | 5 pass | 5 pass |
| model | 10 | 10 pass | 10 pass |
| message | 4 | 4 pass | 4 pass |
| slots | 7 | 7 pass | 7 pass |
| action | 3 | 3 pass | 3 pass |
| nav / route | 15 | 15 pass | 15 pass |
| session | 5 | 5 pass | 5 pass |
| error | 5 | 5 pass | 4 pass, 1 warn (`error.details`) |
| ui5 | 7 | 7 pass | 7 pass |

The ABAP system itself (abap2UI5 on NetWeaver / ABAP Cloud) has not been run
yet - it needs a system with the apps pulled in by abapGit; the transpiled
runtime is the same framework source.

The two hosts do not run the same framework release: cap2UI5 0.5.0 pins
`@abap2ui5/node-runtime` 1.147.0, the node-runtime host runs 1.148.0. The
backend sources of the two releases differ in where helper methods live,
not in what they answer (abap2UI5 `d771aba`..`610d9ae`), and the recorded
traffic of the two is identical ([below](#differences-between-the-two-backends)).

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
**identical** apart from the following. Both are the same framework
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
  normative ([../spec/navigation.md](../spec/navigation.md#the-router-action)).
- **Event argument conversion** (`true` -> `X`, `null`/`false` -> empty,
  objects -> compact JSON text) - normative, the same on both backends.

## Frontend suite

Frontend suite, 81 checks (66 MUST, 15 SHOULD; 66 core, 8 portable, 4 UI5,
3 semantic), run 2026-11-15 against the traffic of the 1.148.0 recording -
the UI5 SPA, the agent client, the Adaptive Cards and the terminal
renderer; the Web Components row is the run of 2026-10-03 and was not
repeated - with
`abap2ui5-conformance frontend --adapter <name>` (each frontend at its
widest profile). The scripted backend answers from
[`../traffic/node-runtime/`](../traffic/node-runtime/) plus synthetic edge
cases. A skip is no verdict: outside the profile, a capability the
frontend does not have (a URL, a DOM, timers), or an interaction it cannot
perform.

| Frontend | Version | Profile | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| UI5 SPA (`ui5`) | abap2UI5 1.148.0 `app/webapp` (release commit `610d9ae`, which CI pins), OpenUI5 1.153.0 (npm), Chromium 153 | ui5 | 77 | 0 | 0 | 4 | conformant (ui5) |
| agent client (`agent`) | abap2UI5/mcp-server `lib/appclient.mjs` @ `a4d9f07` (main, PR #44; vendored) | semantic | 61 | 0 | 0 | 20 | conformant (semantic) - the five MUST deviations of `ea4e9fa` fixed |
| Adaptive Cards renderer (`adaptive-cards`) | [`renderers/adaptive-cards/`](../renderers/adaptive-cards/README.md) of this repository (prototype), Adaptive Cards 1.5 | portable | 66 | 0 | 0 | 15 | every check it can be driven through holds |
| terminal renderer (`terminal`) | [`renderers/terminal/`](../renderers/terminal/README.md) of this repository, driven with keys through its state machine | portable | 72 | 0 | 0 | 9 | every check it can be driven through holds, the router checks included |
| Web Components (`webcomponent`) | abap2UI5/frontend-webcomponent 0.1.0, `dist/` built from main `410d607` (PR #2) - run 2026-10-03, against the 1.146.0 recording | portable | 68 | 0 | 0 | 13 | conformant (portable) in 3 of 4 runs; `model.number-and-boolean` intermittent (below) |
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

Re-vendored at abap2UI5/mcp-server `a4d9f07` (main, PR #44): **every check
that applies passes** - 61 pass, 0 fail, 0 warn, 20 skip, two runs
identical. The five MUST deviations and three warnings measured at
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
on 2026-11-15 with the
vendored client (the commit `adapters/vendor/mcp-server/source.json`
names) against both hosts; its exchanges and snapshots are identical to
the recording of `ea4e9fa` but for the draft ids, and
`semantic.recorded-snapshots` passes against it.

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
