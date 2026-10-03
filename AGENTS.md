# AGENTS.md — abap2UI5 protocol

Guidance for agents and contributors. Read before making any change.

## What this is

The specification of the abap2UI5 roundtrip protocol (`spec/`), its view
profiles (`profiles/`), JSON Schemas (`schema/`) and conformance suites
(`conformance/`), plus recorded real traffic (`traffic/`). It is
**descriptive first**: the protocol was implemented before it was written
down, and the spec records what the implementations do.

## Rules

- **Every normative statement cites its source.** A MUST/SHOULD names the
  file and method it comes from, with the abbreviations of
  `spec/README.md#sources`. A statement you cannot trace to code is a
  proposal - say so, or leave it out.
- **Accidental behaviour is an implementation note, not a rule.** When the
  reference does something odd (draft ids that repeat after a leave, the URL
  reflected into a 500 body), write it under *Implementation note* - another
  implementation must not have to copy it.
- **A rule a backend can break gets a check.** New MUST/SHOULD for backends ->
  a check in `conformance/backend/lib/checks/`, its id on the spec's
  *Checked by* line, `node scripts/gen-check-list.mjs`. `npm test` fails when
  a check cites a missing section or the check list is stale.
- **A rule a frontend can break gets a frontend check** - in
  `conformance/frontend/lib/checks/`, its id on the spec's *Frontend
  check(s)* line, the list regenerated the same way. A check scripts the
  backend (`t.mock.reply(...)`, recorded responses from `traffic/` first,
  synthetic ones for edge cases), drives the frontend only through the
  adapter interface (`fill`, `press`, ... with targets every kind of
  frontend can resolve) and reads the normalized `state()`. A check that
  needs more than the core (a URL, timers, a DOM) declares it in `needs`.
- **A deviation of a real frontend is a finding, not a test to bend.** Decide
  whether the spec or the frontend is wrong, write it into
  `conformance/RESULTS.md` (and the spec, with its source, when the spec
  was wrong), pin the result in `test/frontend.test.mjs`, file it upstream.
- **Provisional decisions go to `spec/open-questions.md`** with the current
  decision and the alternatives, so the maintainer can decide.
- **Behaviour the suite needs lives in a conformance app, twice.** A new app
  or event goes into `conformance/apps/README.md`, the ABAP class
  (`conformance/apps/abap`, abapGit format, abaplint-clean:
  `npm run lint:abap`; also clean in the abap2UI5 linter) AND the cap2UI5
  twin (`conformance/apps/cap2ui5`). `test/traffic.test.mjs` requires both
  backends to answer every check identically.
- **Traffic is recorded, never hand-edited.** `npm run record` rewrites
  `traffic/`; record again after changing a check or an app.
- **Generated sections are generated.** `conformance/backend/README.md`
  (check list), `profiles/portable.md` (between the `portable:*` markers,
  from `profiles/portable-v1.json`) - run `npm run generate`.
- **`profiles/semantic.md` is the normative snapshot v1** (moved from
  abap2UI5/mcp-server `docs/agent-snapshot.md`). Changes to the snapshot
  shape are made here first; implementations follow.
- **The protocol number moves only with a breaking change**
  (`spec/versioning.md`). Additive changes keep protocol 2.
- **Do not edit other repositories from here.** A difference found in a
  backend is filed in `conformance/RESULTS.md` (and upstream), not patched.

## Layout

| Path | |
|---|---|
| `spec/` | the core protocol, one file per area |
| `profiles/` | UI5, portable (v1 + `portable-v1.json` + coverage) and semantic profiles |
| `schema/` | JSON Schemas 2020-12 |
| `conformance/backend/` | the backend suite - the published package's entry (`index.mjs`, `bin/`) |
| `conformance/frontend/` | the frontend suite - `lib/` (scripted backend `mock.mjs`, runner, response builders, `checks/`), `adapters/` (`ui5` Playwright + the boot page, `agent` + the vendored mcp-server client, `webcomponent`, `headless` stub) |
| `conformance/apps/` | the conformance apps (ABAP + cap2UI5) and their abaplint config |
| `conformance/hosts/` | `node-runtime` (build + serve) and `cap2ui5` (a CAP project) reference hosts |
| `traffic/` | recorded traffic per backend: `suite.json`, `ui5-frontend.json`, `agent-client.json` |
| `scripts/` | recorder, runner, generators, `vendor-agent-client.mjs`; `scripts/lib/ui5-frontend.mjs` runs the UI5 frontend's request code in Node |
| `tools/portable-census/` | the census scripts behind the portable profile, as run |
| `test/` | `node:test` - `npm test` |

## Gates

`npm test` is the gate: schemas (shipped validator vs ajv, strict mode),
recorded traffic, cross-backend equality, docs links and anchors, the
portable profile, the conformance apps' abapGit format, the CLI, the
full backend suite against both reference backends (`PROTOCOL_SKIP_BACKENDS=1`
skips those; the cap2UI5 run skips itself when its host is not installed),
and the frontend suite against the agent client (always) and the UI5 SPA
(when an abap2UI5 checkout and a Chromium are there;
`PROTOCOL_SKIP_BROWSER=1` skips it, `PROTOCOL_REQUIRE_BROWSER=1` fails
without them). CI runs the same on Node 22 and 24, and the UI5 SPA in a
job of its own with Chromium. Never `playwright install` in a sandbox that
has browsers already - point `CHROMIUM_BIN` at one.

## Style

ES modules, Node 22+, no runtime dependencies in `conformance/backend/`
and `conformance/frontend/` (the browser adapters import `playwright-core`
lazily). English, ASCII in source files - the vendored copies under
`conformance/frontend/adapters/vendor/` are byte-equal to upstream and
exempt. Markdown wrapped at ~78 columns.
