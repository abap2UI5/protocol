# View profiles

The core protocol ([../spec/core.md](../spec/core.md)) carries views as
strings. A **view profile** says what is in those strings and what a
frontend does with it.

| Profile | Version | For | Who implements it |
|---|---|---|---|
| [UI5](ui5.md) | protocol 2 | the full UI5 XML vocabulary, the wire forms inside it, the page that boots the UI5 frontend | abap2UI5's UI5 SPA (fully); every backend serves it |
| [Portable](portable.md) | v1 | a subset every non-UI5 renderer renders: 61 controls + 4 layout-data elements, restricted binding forms, event wires and frontend actions | UI5 Web Components renderer (planned), later Adaptive Cards / native |
| [Semantic](semantic.md) | snapshot v1 | no rendering: the screen as data - fields, actions, tables, messages | abap2UI5/mcp-server agent client, cap2UI5 agent endpoint, the ABAP agent addon |

How they relate:

- Every backend emits UI5 views; the profiles are about **apps and
  frontends**. An app is *portable* when its views stay inside the portable
  profile - a property a linter can check against
  [portable-v1.json](portable-v1.json).
- The portable profile is a subset of the UI5 profile: the UI5 frontend
  renders every portable app.
- The semantic profile is defined over the UI5 vocabulary; it describes a
  portable app completely and any other app as far as it can, listing the
  rest as `unsupported`.

Coverage of the portable profile over the sample corpora:
[portable-coverage.md](portable-coverage.md).
