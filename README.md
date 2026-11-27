# abap2UI5 protocol

**The written, versioned contract between abap2UI5 frontends and backends -
with JSON Schemas and conformance suites, so either side can be swapped.**

abap2UI5 is server-driven UI ("UI5 over the wire"): the browser frontend
sends one JSON roundtrip per user event - the event, the model delta, the
draft id - and the backend runs the app's `main( )` and answers with views,
the model, messages and frontend actions. That protocol is spoken by
three backends (abap2UI5 on an ABAP system, the same framework transpiled to
Node as `@abap2ui5/node-runtime`, cap2UI5 on CAP) and three frontends (the
UI5 SPA, the MCP server's agent client, the ABAP frontend simulator). This
repository writes it down - as **protocol 3**, released with abap2UI5
1.151.0 and `@cap2ui5/cds-plugin` 0.8.0; abap2UI5 1.150.0 and older speak
protocol 2 ([Status](#status)).

## The layers

```
 profiles/   view profiles - what is inside a view string
   ui5        full UI5 XML + the .eB/.eF wire forms + the boot page   (the UI5 SPA)
   portable   a 61-control subset every renderer renders              (Web Components, native, ...)
   semantic   agent snapshot v1 - the screen as data                  (agents, test drivers)
 ---------------------------------------------------------------------------------
 spec/       the core protocol - mandatory for every frontend and backend
   transport  one endpoint, GET page / POST roundtrip, headers, CSRF, HEAD, sap-contextid
   request    S_FRONT, ROUTE, events and their arguments, the model delta (__delta), CONFIG
   response   S_FRONT, VIEWS / NAV / ACTIONS, the five view slots, MODEL, processing order
   actions    follow-up actions, messages
   sessions   drafts, draft ids as snapshots, expiry, failed roundtrips
   navigation app start resolution, app stack, routes, app-state hash, the NAV section
   errors     the 500 text body and what a frontend does with it
   versioning PROTOCOL 3, what it broke, compatible changes
 schema/     JSON Schemas (2020-12): request, response, snapshot, portable profile
 conformance/
   backend    the backend suite - plays the frontend over HTTP     (implemented)
   frontend   the frontend suite - plays the backend, adapters for (implemented)
              the UI5 SPA (Playwright), the agent client, the
              Web Components frontend, the Adaptive Cards and the
              terminal renderer
   apps       the conformance apps: ABAP classes + cap2UI5 twins
   hosts      the two reference backends, started with the apps deployed
 renderers/
   adaptive-cards  a portable renderer without a browser: response -> Adaptive
              Card 1.5, Action.Submit -> request                    (prototype)
   terminal   an abap2UI5 app in a terminal: keys in, text screen out,
              the CLI abap2ui5-tui (node runtime, cap2UI5, SAP systems)
   common     what both renderers share: view helpers, payload -> request
 traffic/    real traffic of the node runtime, the UI5 frontend and the agent client
```

Start with [spec/core.md](spec/core.md). Every normative statement cites the
source file and method it was derived from ([spec/README.md](spec/README.md#sources)).

## Status

- **Protocol 3**, specification revision 0.9, derived from abap2UI5
  branch `DEV` at `a9c08191` (after 1.150.0) and released with abap2UI5
  1.151.0 (2026-11-26). It breaks protocol 2: the
  response carries its views, its navigation intent and its follow-up
  actions as the sections `VIEWS`, `NAV` and `ACTIONS`, an app start
  carries the route parsed as `ROUTE`, the flags of an event wire are one
  options object ([spec/versioning.md](spec/versioning.md#what-protocol-3-broke)).
  A response looks like this:

  ```json
  { "S_FRONT": { "ID": "982BD4B2BEBE4DEE93371A4671461244", "APP": "Z2UI5_CL_CONF_SLOTS", "PROTOCOL": 3,
      "VIEWS": { "MAIN": { "XML": "<mvc:View ...>...</mvc:View>" },
                 "POPUP": { "DESTROY": true } },
      "NAV": { "setNavRouting": "KEEP" },
      "ACTIONS": [["MESSAGE_TOAST", "show", "Saved"]] },
    "MODEL": { "NAME": "Ada" } }
  ```

  The maintainer decided ten open questions in revision 0.3, question 14
  is resolved, question 15 was decided with protocol 3, question 2 was
  decided again in revision 0.7 (the unchanged timer tick), four are open
  - question 16, the repeating timer in portable renderers, since revision
  0.8 ([spec/open-questions.md](spec/open-questions.md)).
- **Who speaks protocol 3:** abap2UI5 1.151.0 and its `main` branch - the
  backend, the UI5 SPA and `@abap2ui5/node-runtime` 1.151.0
  (`package.json`) - cap2UI5 (`@cap2ui5/cds-plugin` 0.8.0 hosts that
  runtime), the agent client of abap2UI5/mcp-server (vendored here at
  `8a1d7d8`; it reads protocol 3 from `7906a2f`) and the two renderers of
  this repository. **Who still speaks protocol 2:** abap2UI5 1.150.0 and
  older and `@cap2ui5/cds-plugin` 0.7.0 and older. A protocol-2
  frontend refuses a protocol-3 response on its number, and the suites
  of this revision do not measure a protocol-2 implementation; what is
  pinned for each is in [conformance/RESULTS.md](conformance/RESULTS.md).
- **Backend suite** ([the check list](conformance/backend/README.md#checks)):
  `@abap2ui5/node-runtime` 1.151.0 passes every check, `@cap2ui5/cds-plugin`
  0.8.0 every MUST (it hides an app's exception text, a SHOULD) - that is
  what `traffic/` is recorded against. Both do all a backend MAY do with
  a timer the app declares (the five `action.timer-declared*` checks).
- **Schemas** validate every recorded request and response, checked by
  the shipped validator and by ajv.
- **Portable profile v1** filled from a census of 247 core apps (73.7 % by
  controls, 64.8 % run unchanged).
- **Frontend suite** ([the check list](conformance/frontend/README.md#checks)),
  scripted from the recorded traffic: the UI5 SPA of abap2UI5 1.151.0, the
  agent client of mcp-server, the Adaptive Cards renderer and the terminal
  renderer pass every check that applies to them
  ([conformance/RESULTS.md](conformance/RESULTS.md#frontend-suite)).
- **Adaptive Cards renderer** (prototype, [renderers/adaptive-cards/](renderers/adaptive-cards/README.md)):
  all 65 portable controls mapped onto Adaptive Cards 1.5, the way back from
  an `Action.Submit` to the next request, golden cards of recorded traffic.
- **Terminal renderer** ([renderers/terminal/](renderers/terminal/README.md)):
  an abap2UI5 app in a terminal - `npx abap2ui5-tui <url> --app <CLASS>`
  against the node runtime, cap2UI5 or an SAP system (basic auth, cookies,
  CSRF, `sap-contextid`), all 65 portable controls as keyboard-driven
  widgets, a hash history so Back works, `--print` for logs, CI and screen
  readers; pure Node, no dependencies.
- Not yet run against an ABAP system.

## Run the backend suite

```bash
npm ci

# against any backend that serves the conformance apps
npx abap2ui5-conformance backend --url http://localhost:3000/ --profile ui5

# against the reference backends
npm run conformance:node-runtime        # transpiles the framework with the ABAP apps, serves, runs
npm ci --prefix conformance/hosts/cap2ui5
npm run conformance:cap2ui5             # plugin 0.8.0 on the runtime 1.151.0
```

`package.json` pins the released `@abap2ui5/node-runtime` 1.151.0, which
speaks protocol 3. To measure a build of abap2UI5 `main` instead, install
a runtime packed from that checkout over it
(`npm run pack:node-runtime -- --out <dir>` there, then
`npm install --no-save <dir>/abap2ui5-node-runtime-*.tgz` here).

To test your backend: deploy the [conformance apps](conformance/apps/README.md)
(abapGit for ABAP; the JS twins for cap2UI5), point `--url` at the endpoint.
Options, the library API and the check list:
[conformance/backend/README.md](conformance/backend/README.md).

## Run the frontend suite

```bash
npx abap2ui5-conformance frontend --adapter ui5      # the UI5 SPA (ABAP2UI5_HOME=<abap2UI5 checkout>) in Chromium
npx abap2ui5-conformance frontend --adapter agent    # the agent client of abap2UI5/mcp-server
npx abap2ui5-conformance frontend --adapter adaptive-cards   # the Adaptive Cards renderer of this package
npx abap2ui5-conformance frontend --adapter terminal         # the terminal renderer of this package
```

## Run an app in the terminal

```bash
npm run serve:node-runtime &                     # the conformance apps on http://localhost:3000/
npx abap2ui5-tui http://localhost:3000/ --app Z2UI5_CL_CONF_BIND
npx abap2ui5-tui "https://host/sap/bc/z2ui5?sap-client=100" --app Z2UI5_CL_MY_APP --user ME --print
```

Keys, options and the control mapping: [renderers/terminal/README.md](renderers/terminal/README.md).

Adapters, options and the check list:
[conformance/frontend/README.md](conformance/frontend/README.md).

## Develop

```bash
npm test                 # schemas, traffic, docs, portable profile, CLI, both backends,
                         # the frontend suite (agent client, Adaptive Cards and terminal
                         # renderer; UI5 SPA with a checkout + Chromium), the golden
                         # cards and screens, the terminal against the node runtime
                         # (PROTOCOL_SKIP_BACKENDS=1 / PROTOCOL_SKIP_BROWSER=1 skip the slow parts)
npm run record           # re-record traffic/ (the node runtime and cap2UI5)
npm run lint:abap        # abaplint over the ABAP conformance apps
npm run generate         # regenerate the check lists, the portable-profile sections and
                         # the Adaptive Cards and terminal mapping tables
npm run demo:adaptive-cards -- slots.popup-destroy 0 1   # a recorded response as card JSON
```

Node 22 or later. The package has no runtime dependencies; the dev
dependencies are the reference backend (`@abap2ui5/node-runtime`, the
transpiler, express), abaplint, ajv, and for the UI5 adapter
`playwright-core` and the `@openui5/sap.m` source packages (UI5 without a
CDN).

## Related

[abap2UI5](https://github.com/abap2UI5/abap2UI5) (backend + UI5 frontend) ·
[cap2UI5](https://github.com/cap2UI5/cap2UI5) ·
[mcp-server](https://github.com/abap2UI5/mcp-server) (agent client, snapshot implementation) ·
[headless-frontend](https://github.com/abap2UI5/headless-frontend) ·
[linter](https://github.com/abap2UI5/linter)

## License

MIT
