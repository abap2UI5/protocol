# Results

Backend suite, profile `ui5` (76 checks: 69 core, 7 UI5-profile; 62 MUST,
14 SHOULD), run 2026-10-03 with `npm run conformance:<backend>`. The traffic
of these runs is recorded in [`../traffic/`](../traffic/). Revision 0.3 added
`error.no-reflection` (MUST, [open question 3](../spec/open-questions.md#3-the-request-url-reflected-into-the-error-body));
both reference backends fail it - see [below](#the-request-url-reflected-into-the-error-body).

| Backend | Version | Apps | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| `node-runtime` | `@abap2ui5/node-runtime` 1.146.0 (abap2UI5 1.146.0, transpiled) | the ABAP apps, transpiled with `@abaplint/transpiler-cli` 2.13.93 | 75 | 1 | 0 | 0 | one MUST failed: `error.no-reflection` (fix in abap2UI5 core, pinned) |
| `cap2ui5` | `@cap2ui5/cds-plugin` 0.4.0 on `@abap2ui5/node-runtime` 1.146.0, `@sap/cds` 10 | the JavaScript apps | 74 | 1 | 1 | 0 | one MUST failed: `error.no-reflection` (inherited from the runtime, pinned) |

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
| nav / route | 14 | 14 pass | 14 pass |
| session | 5 | 5 pass | 5 pass |
| error | 5 | 4 pass, 1 fail (`error.no-reflection`) | 3 pass, 1 fail (`error.no-reflection`), 1 warn (`error.details`) |
| ui5 | 7 | 7 pass | 7 pass |

The ABAP system itself (abap2UI5 on NetWeaver / ABAP Cloud) has not been run
yet - it needs a system with the apps pulled in by abapGit; the transpiled
runtime is the same framework source.

## The request URL reflected into the error body

`error.no-reflection` (MUST since revision 0.3) starts an unknown app with
`<script>`, `<img>` and quotes in the request URL and requires the 500 body
not to contain them verbatim. Both reference backends fail it, identically:

```
Request failed, no event (initial rendering), app_start Z2UI5_CL_CONF_DOES_NOT_EXIST,
url /?app_start=Z2UI5_CL_CONF_DOES_NOT_EXIST&conformance=<script>alert("conformance-probe")</script><img src='conf...
```

The class name is stripped to name characters ([ACT] `app_start_safe`),
the URL is not (abap2UI5 1.146.0, [H] `request_context_info`). *The
backend is wrong* (the maintainer's decision on
[open question 3](../spec/open-questions.md#3-the-request-url-reflected-into-the-error-body)):
the fix strips the URL like the class name and is made in abap2UI5 core
(`ed8115b` "Strip the request URL to safe characters in the 500 body", on
its working branch on 2026-10-03); cap2UI5 hosts the same framework and
gets it with the runtime. Until both
reference hosts run a release with the fix, the failure is pinned in
[`../test/lib/expected.mjs`](../test/lib/expected.mjs) (the tests fail
when it starts to pass, so the pin is removed with the bump) and the
recorded traffic carries it (`counts.fail` 1 on both).

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
  [../spec/errors.md](../spec/errors.md#the-error-response)).
- **`DEFAULT` routing mode on every hop to an app without a mode** -
  normative ([../spec/navigation.md](../spec/navigation.md#the-router-action)).
- **Event argument conversion** (`true` -> `X`, `null`/`false` -> empty,
  objects -> compact JSON text) - normative, the same on both backends.

## Frontend suite

Frontend suite, 81 checks (66 MUST, 15 SHOULD; 66 core, 8 portable, 4 UI5,
3 semantic), run 2026-10-03 (the terminal renderer and the Adaptive Cards
renderer again 2026-10-04) with
`abap2ui5-conformance frontend --adapter <name>` (each frontend at its
widest profile). The scripted backend answers from
[`../traffic/node-runtime/`](../traffic/node-runtime/) plus synthetic edge
cases. A skip is no verdict: outside the profile, a capability the
frontend does not have (a URL, a DOM, timers), or an interaction it cannot
perform.

| Frontend | Version | Profile | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| UI5 SPA (`ui5`) | abap2UI5 main `1bbb9d4` `app/webapp` (which CI pins), OpenUI5 1.153.0 (npm), Chromium 141 | ui5 | 77 | 0 | 0 | 4 | conformant (ui5) - `portable.box-details` fixed in abap2UI5 `72c86cc` |
| agent client (`agent`) | abap2UI5/mcp-server `lib/appclient.mjs` @ `a4d9f07` (main, PR #44; vendored) | semantic | 61 | 0 | 0 | 20 | conformant (semantic) - the five MUST deviations of `ea4e9fa` fixed |
| Adaptive Cards renderer (`adaptive-cards`) | [`renderers/adaptive-cards/`](../renderers/adaptive-cards/README.md) of this repository (prototype), Adaptive Cards 1.5 | portable | 66 | 0 | 0 | 15 | every check it can be driven through holds |
| terminal renderer (`terminal`) | [`renderers/terminal/`](../renderers/terminal/README.md) of this repository, driven with keys through its state machine | portable | 72 | 0 | 0 | 9 | every check it can be driven through holds, the router checks included |
| Web Components (`webcomponent`) | abap2UI5/frontend-webcomponent 0.1.0, `dist/` built from main `410d607` (PR #2) | portable | 68 | 0 | 0 | 13 | conformant (portable) in 3 of 4 runs; `model.number-and-boolean` intermittent (below) |
| headless ABAP simulator (`headless`) | - | - | - | - | - | - | not drivable: in-process, no HTTP seam ([frontend/README.md](frontend/README.md#adapters)) |

The UI5 SPA run is stable (two consecutive runs, identical results) and
takes about two minutes; `test/frontend.test.mjs` pins the UI5, the agent,
the Adaptive Cards and the terminal result check by check. Until 2026-10-10
CI pinned abap2UI5 `5d7e91f` (`app/webapp` as at `b812079`, 1.146.0), where
the UI5 SPA failed `portable.box-details` (finding 1 below; 76 pass, 1 fail,
4 skip, with OpenUI5 1.144.0 and 1.153.0 alike). abap2UI5 fixed it on main in
`72c86cc` (open question 7, decided: expanded); CI pins a main that carries
the fix, and the pin is gone - every MUST holds, 77 pass, 4 skip.

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
programmatic model edit. `traffic/*/agent-client.json` is still the
recording of `ea4e9fa`; `semantic.recorded-snapshots` passes against it.

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
