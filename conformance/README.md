# Conformance

Conformance is tested in both directions, so backends and frontends can be
swapped independently:

| Suite | Plays | Tests | Status |
|---|---|---|---|
| [backend/](backend/README.md) | the frontend | a backend, over HTTP, against the conformance apps | implemented - 75 checks, `abap2ui5-conformance backend` |
| [frontend/](frontend/README.md) | the backend | a frontend, by scripted responses | reserved |

The **conformance apps** ([apps/](apps/README.md)) are what a backend serves
for the backend suite: small apps with exactly specified behaviour, shipped
as ABAP classes (for abap2UI5 and every backend that runs ABAP apps) and as
cap2UI5 JavaScript apps.

The **reference hosts** ([hosts/](hosts/)) start the two reference backends
with the apps deployed: `hosts/node-runtime` (`@abap2ui5/node-runtime`, the
ABAP apps transpiled on the fly) and `hosts/cap2ui5` (a minimal CAP project
with `@cap2ui5/cds-plugin` and the JavaScript apps).

Results per backend and the differences found: [RESULTS.md](RESULTS.md).
