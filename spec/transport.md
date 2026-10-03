# Transport

## Endpoint

A backend exposes **one URL**, the endpoint. The same URL answers the page
GET (UI5 profile) and every roundtrip POST: the UI5 frontend posts to the
URL its page was loaded from in standalone mode, or to the URI its manifest
names in a launchpad or a BSP ([SRV] `_post` uses `ctx.state.url`).
Implementations mount it where they like: an ICF node on an ABAP system
([HTTP] `run`), every path of the Node server ([NR] `createApp`), the routes
`/sap/bc/z2ui5` and `/rest/root/z2ui5` of a CAP server ([CAP]).

- A frontend MUST send every roundtrip to the endpoint and MUST NOT derive
  other URLs from it.
- A backend MUST answer a roundtrip POST on the endpoint regardless of the
  query string the endpoint URL carries (`?app_start=...` stays in the page
  URL and travels inside the body, [request.md](request.md#app-start-shaped-requests)).

## The page GET

`GET <endpoint>` answers the HTML page that boots the UI5 frontend
([HTTP] `_http_get`). It belongs to the UI5 profile
([../profiles/ui5.md](../profiles/ui5.md#the-page)); a backend that serves
only other frontends MAY answer a GET with anything, and a non-UI5 frontend
MUST NOT need it. The reference also answers `GET <endpoint>?z2ui5-bundle`
with the frontend as one JavaScript file for embedding hosts
([HTTP] `_http_get_bundle`) - UI5 profile as well.

## The roundtrip POST

A roundtrip is one `POST <endpoint>` with a JSON body
([request.md](request.md)) and a JSON answer ([response.md](response.md)).

- The frontend MUST send `Content-Type: application/json` ([SRV] `_post`).
- On success the backend MUST answer **HTTP 200** with
  `Content-Type: application/json` (the reference adds `; charset=UTF-8`)
  and a body that is a response object ([HTTP] `set_response`).
  *Checked by:* `transport.post-json`.
- A failed roundtrip is answered with an error status and a text body
  ([errors.md](errors.md)), never with a 2xx.
- The body is UTF-8 JSON. A frontend MUST be able to read a response of
  several megabytes (the model travels whole); the Node and CAP servers
  accept request bodies up to 10 MB by default ([NR] `createApp bodyLimit`,
  [CAP] `body_parser.limit`).

### Request headers

| Header | Sent by the UI5 frontend | Meaning |
|---|---|---|
| `Content-Type: application/json` | always | |
| `sap-contextid-accept: header` | always ([SRV] `_post`) | asks for the stateful session id in a response header instead of a cookie ([stateful sessions](#stateful-sessions-sap-contextid)) |
| `sap-contextid: <id>` | only when a valid id is held ([LIB] `isValidContextId`) | the stateful session to continue. A frontend MUST NOT send it empty or as the text `undefined` - web dispatchers log every such request |
| `X-CSRF-Token: <token>` | only after a token layer handed one out ([SRV] `_fetchCsrfToken`) | see [CSRF](#csrf-and-origin) |
| `Origin` | by the browser | checked by the backend's CSRF gate |

A frontend MAY send further headers (authentication); a backend MUST ignore
headers it does not know.

- A frontend MUST send `Content-Type: application/json` with every
  roundtrip POST ([SRV] `_post`). *Frontend check:* `request.content-type`.
- A frontend SHOULD send `sap-contextid-accept: header` with every roundtrip
  POST: without it a backend that switches to a stateful session hands the
  session id out as a cookie ([HTTP] `set_response`), which a frontend on
  another origin or without a cookie jar (the agent client) never sends
  back. *Frontend checks:* `transport.contextid-accept`,
  `transport.contextid-only-when-held`.

### Response headers and caching

- A roundtrip response SHOULD carry `Cache-Control: no-cache, no-store,
  must-revalidate` (the reference also sends `Pragma: no-cache`,
  `Expires: 0`) - it carries user data and must never be stored or
  revalidated ([HTTP] `set_response`). *Checked by:* `transport.no-store`.
- A backend MAY compress responses (`Content-Encoding: gzip`) when the
  request allows it; the reference asks the ICF to on an ABAP system and
  compresses bodies of 1 KB or more on Node and CAP ([HTTP] `set_response`,
  [NR] `compress`). A frontend MUST accept a compressed response.
- The security headers the backend's user exit configures (CSP,
  `X-Frame-Options`, ...) travel on every response ([HTTP]
  `set_response_exit_headers`); the protocol does not prescribe them.

### The envelope

The UI5 frontend wraps the request payload as `{ "value": <payload> }`
([SRV] `readHttp`). A launchpad shell or a gateway may strip that envelope
on the way.

- A frontend MUST send the envelope. *Frontend check:* `request.envelope`.
- A backend MUST accept both shapes: `{ "value": { "S_FRONT": ... } }` and
  the bare `{ "S_FRONT": ... }` - it detects the envelope by the presence
  of the key `value` at the root ([H] `request_parse_body`).
  *Checked by:* `transport.envelope-optional`.

**Implementation note.** The responses carry no envelope; only requests
do. That asymmetry is historic (the request shape follows an OData-like
`{ value }` convention) and is kept because every deployed frontend sends
it.

### Bodies a backend must tolerate

| Body | Backend answer |
|---|---|
| empty (no body at all) | the same as `{}` ([H] `request_parse_body`) |
| valid JSON without `S_FRONT` (`{}`, `{ "value": {} }`, `null`) | an app start without a class: the backend's start app (SHOULD, [navigation.md](navigation.md#which-app-a-request-starts)) |
| not JSON | an error status ([errors.md](errors.md)) - MUST NOT be a 2xx |
| more than 100 event arguments | an error status (SHOULD, [H] `c_event_arg_limit`) |

The first two exist because availability probes of monitors and load
balancers POST exactly that; the reference answered them with a 500 once.
*Checked by:* `transport.empty-body`, `transport.invalid-json`,
`event.argument-limit`.

## CSRF and origin

The backend runs a CSRF gate over every state-changing request - `POST` and
`HEAD` ([HTTP] `main`, `check_csrf_rejected_request`, `_check_csrf_rejected`):

1. Take `Origin`; when it is absent, `Referer`. When neither is present the
   request passes (proxies and old clients strip them).
2. Take the host to compare with: the first entry of `X-Forwarded-Host`
   when the installation trusts it (default on), else `Host`.
3. Reduce both to `host[:port]`, lower case, the scheme, path, query and
   fragment removed and a default port (`:443`, `:80`) dropped.
4. When they differ the request is refused: **HTTP 403**, `text/plain`, body
   `CSRF validation failed - cross-origin request rejected`.

- A backend SHOULD run this gate (the reference runs it unless the user
  exit switches it off, [EXIT] `check_csrf_active`).
  *Checked by:* `transport.csrf-origin`.
- **Token layers.** A layer in front of the backend - an SAP approuter route
  with `csrfProtection`, a Gateway - may refuse a POST with **403** and
  `X-CSRF-Token: Required`. A frontend SHOULD then fetch a token with
  `HEAD <endpoint>` and `X-CSRF-Token: Fetch`, take the token from the
  response header of the same name, and re-send the same body **once** with
  `X-CSRF-Token: <token>`; it sends that token with every later POST
  ([SRV] `_csrfTokenRequired`, `_fetchCsrfToken`). A 403 without
  `X-CSRF-Token: Required` is the backend's own gate and final - a frontend
  MUST NOT retry it. *Frontend checks:* `transport.csrf-token`,
  `transport.csrf-final`.

## HEAD: session terminate and token fetch

Two HEAD requests reach the endpoint, both from the frontend
([HTTP] `main`):

- `HEAD` with `sap-terminate: session` (and the `sap-contextid` it ends): the
  page is closing; the backend ends the stateful session
  ([SRV] `endSession`, sent with `keepalive` on unload).
- `HEAD` with `X-CSRF-Token: Fetch`: the token fetch above - a token layer
  answers it; it reaches the backend only forwarded and MUST NOT end a
  session there.

The backend SHOULD answer both with an empty **200** through its normal
response path (status and security headers set, `no-store`).
*Checked by:* `transport.head-terminate`.

**Implementation note.** To HTTP, HEAD on the page URL would be "GET without
a body". abap2UI5 repurposes it, deliberately: nothing but its own
frontend sends HEAD to this URL ([HTTP] `main`, the comment on the HEAD
branch).

## Other methods

A method other than GET, POST and HEAD SHOULD be answered **405**
(`Method Not Allowed`, [HTTP] `_main`). *Checked by:*
`transport.method-not-allowed`.

## Stateful sessions (sap-contextid)

An ABAP app MAY switch its session to stateful (`set_session_stateful( )`,
[IC]): the work process and everything the app does not serialise survive
between roundtrips. The switch travels outside the body ([TY] `ty_s_next-s_stateful`):

- The backend switches the server session and, when the request carried
  `sap-contextid-accept: header`, moves the session id from the
  `sap-contextid` cookie into a `sap-contextid` **response header**; on
  requests that do not switch, it echoes a received `sap-contextid` back
  ([HTTP] `set_response`).
- A frontend MUST keep the last valid `sap-contextid` response header and
  send it with every later POST; a response without the header MUST NOT
  wipe an established id ([SRV] `readHttp`). This holds for every frontend
  that talks HTTP, not only for browsers: a stateful ABAP app answers a
  POST without its session id from a fresh work process (decided in
  revision 0.3, [open question 9](open-questions.md#9-stateful-sessions-and-frontends-without-a-browser)).
  *Frontend check:* `transport.contextid-kept`.
- A frontend SHOULD end the session with the terminate HEAD when the page
  closes.
- While a session is stateful the backend answers it from the app instance
  it kept and **ignores the draft id** of the request ([ACT]
  `factory_by_frontend`, [HTTP] `_http_post` `so_sticky_handler`); a draft is
  saved only when a route or an app-state link needs one ([H]
  `main_end_save`).
- Backends without stateful sessions MAY refuse the switch: the Node
  runtime keeps one process and has no work-process model, cap2UI5 throws
  on `set_session_stateful( )` ([CAP] `define-app.js`). A frontend MUST work
  against a backend that never sends `sap-contextid`.

The backend suite does not test stateful sessions (no conformance app uses
them): their behaviour depends on the server, not on the protocol.

## Client behaviour

These are rules for frontends; they keep a session consistent.

- **One roundtrip at a time.** While a roundtrip is in flight a frontend
  MUST NOT start another one for a user event; it either drops the event or
  - for a wire flagged queue-last - keeps the last one and sends it after
  the response ([V1] `eB`, `_dispatchQueuedEvent`). A restore triggered by
  browser history MAY supersede the request in flight; the older response
  is then dropped ([SRV] `readHttp` `isStale`). A user event is whatever
  the frontend's user asks for - a click, or a call of a program driving
  the frontend (an agent's `act`): two overlapping requests on one session
  continue the same draft, and the later answer silently drops what the
  earlier one did. A frontend driven by a program SHOULD queue such a call
  and start it once the response in flight is adopted (it MAY refuse it
  instead; decided in revision 0.3,
  [open question 8](open-questions.md#8-one-roundtrip-at-a-time-for-frontends-driven-by-a-program)).
  *Frontend checks:* `transport.one-at-a-time`, `ui5.wire-queue-last`.
- **Timeout.** The UI5 frontend gives up after 600 s ([SRV]
  `REQUEST_TIMEOUT_MS`); a frontend SHOULD have a timeout.
- **Retry.** After a network failure, a timeout or a 502/503/504 a frontend
  MAY re-send the **same body** - it continues the same draft id, which the
  backend accepts ([sessions.md](sessions.md#drafts-are-snapshots)). A 500
  MUST NOT be retried automatically: the backend ran and failed, and would
  fail again ([SRV] `readHttp`). *Frontend check:* `transport.no-retry-500`.
