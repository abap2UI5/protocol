# abap2UI5 protocol

**The written, versioned contract between abap2UI5 frontends and backends -
with JSON Schemas and conformance suites, so either side can be swapped.**

abap2UI5 is server-driven UI ("UI5 over the wire"): the browser frontend
sends one JSON roundtrip per user event - the event, the model delta, the
draft id - and the backend runs the app's `main( )` and answers with views,
the model, messages and frontend actions. That protocol is spoken today by
three backends (abap2UI5 on an ABAP system, the same framework transpiled to
Node as `@abap2ui5/node-runtime`, cap2UI5 on CAP) and three frontends (the
UI5 SPA, the MCP server's agent client, the ABAP frontend simulator). This
repository writes it down.

## The layers

```
 profiles/   view profiles - what is inside a view string
   ui5        full UI5 XML + the .eB/.eF wire forms + the boot page   (the UI5 SPA)
   portable   a 61-control subset every renderer renders              (Web Components, native, ...)
   semantic   agent snapshot v1 - the screen as data                  (agents, test drivers)
 ---------------------------------------------------------------------------------
 spec/       the core protocol - mandatory for every frontend and backend
   transport  one endpoint, GET page / POST roundtrip, headers, CSRF, HEAD, sap-contextid
   request    S_FRONT, events and their arguments, the model delta (__delta), CONFIG
   response   S_FRONT, T_SYSTEM / T_CUSTOM, the five view slots, MODEL, processing order
   actions    follow-up actions, messages
   sessions   drafts, draft ids as snapshots, expiry, failed roundtrips
   navigation app start resolution, app stack, routes, app-state hash, ROUTER action
   errors     the 500 text body and what a frontend does with it
   versioning PROTOCOL 2, compatible changes
 schema/     JSON Schemas (2020-12): request, response, snapshot, portable profile
 conformance/
   backend    the backend suite - plays the frontend over HTTP     (implemented)
   frontend   the frontend suite - plays the backend, adapters for (implemented)
              the UI5 SPA (Playwright), the agent client, the
              Web Components frontend
   apps       the conformance apps: ABAP classes + cap2UI5 twins
   hosts      the two reference backends, started with the apps deployed
 traffic/    real traffic of both reference backends and three frontends
```

Start with [spec/core.md](spec/core.md). Every normative statement cites the
source file and method it was derived from ([spec/README.md](spec/README.md#sources)).

## Status

- **Protocol 2**, specification revision 0.2, derived from abap2UI5 1.146.0
  (commit `b812079`).
- **Backend suite: 75 checks** (61 MUST, 14 SHOULD; 68 core, 7 UI5 profile).
  Green against both reference backends - `node-runtime` 75/75,
  `cap2ui5` 74/75 with one SHOULD warning ([conformance/RESULTS.md](conformance/RESULTS.md)).
- **Schemas** validate all 334 recorded requests, 320 responses and 18 agent
  snapshots, checked by the shipped validator and by ajv.
- **Portable profile v1** filled from a census of 247 core apps (73.7 % by
  controls, 64.8 % run unchanged).
- **Frontend suite: 81 checks** (66 MUST, 15 SHOULD; 66 core, 8 portable,
  4 UI5, 3 semantic), scripted from the recorded traffic. The official UI5
  SPA passes every MUST but one - message box details stay empty on OpenUI5
  >= 1.120; the agent client fails 5 MUSTs (no PROTOCOL check, no
  `sap-contextid`, overlapping acts, popups kept across an app change, error
  markup stripped) ([conformance/RESULTS.md](conformance/RESULTS.md#frontend-suite)).
- Decisions still open for the maintainer: [spec/open-questions.md](spec/open-questions.md).
- Not yet run against an ABAP system.

## Run the backend suite

```bash
npm ci

# against any backend that serves the conformance apps
npx abap2ui5-conformance backend --url http://localhost:3000/ --profile ui5

# against the reference backends
npm run conformance:node-runtime        # transpiles the ABAP apps, serves, runs
npm ci --prefix conformance/hosts/cap2ui5
npm run conformance:cap2ui5
```

To test your backend: deploy the [conformance apps](conformance/apps/README.md)
(abapGit for ABAP; the JS twins for cap2UI5), point `--url` at the endpoint.
Options, the library API and the check list:
[conformance/backend/README.md](conformance/backend/README.md).

## Run the frontend suite

```bash
npx abap2ui5-conformance frontend --adapter ui5      # the UI5 SPA (ABAP2UI5_HOME=<abap2UI5 checkout>) in Chromium
npx abap2ui5-conformance frontend --adapter agent    # the agent client of abap2UI5/mcp-server
```

Adapters, options and the check list:
[conformance/frontend/README.md](conformance/frontend/README.md).

## Develop

```bash
npm test                 # schemas, traffic, docs, portable profile, CLI, both backends,
                         # the frontend suite (agent client; UI5 SPA with a checkout + Chromium)
                         # (PROTOCOL_SKIP_BACKENDS=1 / PROTOCOL_SKIP_BROWSER=1 skip the slow parts)
npm run record           # re-record traffic/ from both backends
npm run lint:abap        # abaplint over the ABAP conformance apps
npm run generate         # regenerate the check list and the portable-profile sections
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
