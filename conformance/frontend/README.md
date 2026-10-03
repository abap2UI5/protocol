# Frontend conformance suite (reserved)

**Not implemented yet** - this folder reserves the place and records the
design. `abap2ui5-conformance frontend` answers so (exit code 2).

## What it will do

The backend suite plays the frontend against a real backend. The frontend
suite turns that around: it **plays the backend** - a scripted HTTP server
that answers the roundtrips of the frontend under test with recorded
responses - and checks what the frontend sends and what it does:

- **Requests** - the envelope, `S_FRONT` per request kind (app start, event,
  route restore), `T_EVENT_ARG` from a wire's arguments, the model delta
  (`buildDeltaFromPaths` rules: whole attribute, `__delta` rows, nested
  tables, the model of the slot the event came from), the `CONFIG` cadence,
  `MS_CLIENT_PREV`, the headers (`sap-contextid-accept`, `sap-contextid`
  only when valid, the CSRF token handshake), every request validated
  against `schema/request.schema.json`.
- **Responses** - adopting `ID` (the next request continues it), refusing a
  different `PROTOCOL`, tolerating an absent one and unknown keys, running
  `T_SYSTEM` before `T_CUSTOM` and both in order, slot rules (a MAIN display
  takes the popup down, an `APP` change tears down POPUP/POPOVER, a NEST is
  inserted into its anchor), `MODEL` absent means unchanged, pending edits
  survive a push, an unknown follow-up action is skipped.
- **Errors** - a non-2xx is shown as text (never as markup), no automatic
  retry after a 500, retry with the same body after a network error.
- **Profiles** - a UI5-profile frontend renders the wire forms and fires the
  right events; a portable frontend renders the portable view corpus (the
  views of `profiles/portable-v1.json`'s controls, with expected
  screenshots or DOM assertions); a semantic frontend produces the expected
  snapshots (`schema/snapshot.schema.json`, the recorded snapshots in
  `traffic/*/agent-client.json`).

## How a frontend will be driven

A frontend is not an HTTP server, so the suite needs a driver per frontend
kind:

| Frontend | Driver |
|---|---|
| UI5 SPA (`app/webapp`) | a browser (Playwright) loading the page from the scripted server; user events through the DOM |
| agent client (mcp-server `lib/appclient.mjs`) | its API: `start`, `act` - in process |
| headless simulator (ABAP) | an ABAP unit test against recorded responses (in-process frontend, no transport) |
| a portable renderer | a browser, like the UI5 SPA |

`scripts/lib/ui5-frontend.mjs` - the UI5 frontend's own request code run in
Node against a live backend - is the seed of the request half: it already
records what the real frontend sends (`traffic/*/ui5-frontend.json`).

The scripted responses come from `traffic/` (normalized), so the two suites
stay two views of one recorded conversation.
