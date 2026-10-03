# Changelog

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
