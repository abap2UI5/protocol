# Versioning

## The protocol number

Every response declares the wire it speaks as `S_FRONT.PROTOCOL`, an
integer - **3** today ([TY] `c_protocol`, stamped by [H]
`response_abap_to_json`; the frontend's own number is [SRV] `PROTOCOL`).

- A backend MUST send `PROTOCOL` in every 2xx response. *Checked by:*
  `response.protocol`.
- A frontend MUST compare it with the number it was written for before it
  reads anything else, and treat a **present and different** number as an
  error that says which side is older ([SRV] `readHttp`) - nothing of such
  a response is adopted or shown, its `ID` included. The message SHOULD
  name both numbers.
- A frontend SHOULD let a response **without** `PROTOCOL` through: a backend
  older than the field cannot be told from one that is merely older, and
  refusing it would break pairings that work.
- *Frontend checks:* `response.protocol-mismatch`,
  `response.protocol-mismatch-message`, `response.protocol-absent`.
- Requests carry no protocol number; the backend reads what it knows and
  ignores the rest ([request.md](request.md)).

The number is not the product version (`z2ui5_if_app=>version`, 1.150.0)
and does not move with a release. It moves when a response can no longer be
read by a frontend written for the previous number - the `S_ACTION`
envelope replacing `S_FRONT.PARAMS` was such a change (protocol 2), and so
was the flattening of the bound attributes out of `MODEL.XX`; the sections
`VIEWS`, `NAV` and `ACTIONS` replacing that envelope are the next
([protocol 3](#what-protocol-3-broke)). Both halves are raised in the
change that breaks the wire.

Why it exists: backend and frontend ship together in abap2UI5, but not
everywhere - a port of the framework, a pinned webapp, a third-party shell
pair them across ages, and without the number the failure was a page that
rendered nothing with no error anywhere.

## What protocol 3 broke

Protocol 3 is the wire of abap2UI5 after 1.150.0 (branch `DEV`,
`1445078`). A frontend of protocol 2 and a backend of protocol 3, or the
other way round, do not work together: the frontend refuses the response
on its number ([above](#the-protocol-number)), and a backend of protocol
3 that is sent a protocol-2 request reads no route out of its `HASH`.
Against protocol 2:

| Protocol 2 | Protocol 3 | Where |
|---|---|---|
| `S_FRONT.S_ACTION.T_SYSTEM`: `["VIEW_SLOTS", "display", <slot>, <view>, <options>?]`, `["VIEW_SLOTS", "destroy", <slot>]`, sent in slot order | `S_FRONT.VIEWS`: `{ "<slot>": { "XML", "OPT"? } }` / `{ "<slot>": { "DESTROY": true } }`; the frontend applies them in slot order | [response.md](response.md#views) |
| `["ROUTER", "sync", <options>]`, last in `T_SYSTEM` | `S_FRONT.NAV`: the options object itself | [navigation.md](navigation.md#the-nav-section) |
| `S_FRONT.S_ACTION.T_CUSTOM` | `S_FRONT.ACTIONS`, entries and order unchanged | [actions.md](actions.md) |
| the frontend takes POPUP and POPOVER down when a response names another `APP`; the backend says the teardown only for a hop between two instances of one class | the backend says the teardown for every app hop and every app start; the frontend acts on what `VIEWS` says | [response.md](response.md#view-slots) |
| the backend drops a teardown of POPUP or POPOVER next to a MAIN display | the teardown travels; that a new MAIN view takes the standalone slots down is the frontend's rule alone | [response.md](response.md#view-slots) |
| the backend resolves an app start from the route or the app-state link it parses out of `HASH` | the frontend parses the hash and sends `S_FRONT.ROUTE`; the backend reads no hash structure | [request.md](request.md#route) |
| event wire flags by position: `.eB(['EVENT', false, false, false, <queueLast>, <noBusy>], ...)` | one options object behind the name: `.eB(['EVENT', { queueLast: true, noBusy: true }], ...)` | [../profiles/ui5.md](../profiles/ui5.md#event-wires) |
| `setPushState` / `setHashReplace` appended to whatever hash the page has | written only for an app that owns the hash (a listener, routing off), as the whole app hash | [navigation.md](navigation.md#the-app-owned-hash) |

The request is otherwise the one of protocol 2 - envelope, `S_FRONT`,
the model delta, `CONFIG` - and so are `MODEL`, the follow-up actions, the
windowed tables, drafts and errors. The app-driven window, which changed
the meaning of `___ZZZ_WIN` under protocol 2 after 1.150.0, is part of
protocol 3 from its first day
([open question 15](open-questions.md#15-the-app-driven-window-and-the-protocol-number),
answered).

## Compatible changes within protocol 3

These do not change the number, and every implementation MUST tolerate
them:

- a new optional key in `S_FRONT`, in an entry of `VIEWS`, in an action's
  option object, in a `CONFIG` block (request) or in the snapshot
  (semantic profile);
- a new follow-up action, or a new global target of `CONTROL_GLOBAL` - a
  frontend that does not know it skips it ([actions.md](actions.md));
- a new slot option (a key of `OPT`);
- a new `NAV` option;
- a new reserved key of `MODEL` and a new reserved event name - `__WINDOW`
  and `___ZZZ_WIN` of [windowed-tables.md](windowed-tables.md) came that
  way in revision 0.5: a frontend that knows neither reads a windowed
  table as a short one and never sends the event, a backend that knows
  neither never sends the key.

These DO break the wire and need a new protocol number: renaming or removing
a key; changing a key's type or meaning; changing the shape of an action
array or of a `VIEWS` entry; adding a slot or a section a frontend must
read for the screen to be right.

## This specification's own version

The specification has a revision of its own (0.7, see
[README.md](README.md)), and the package `@abap2ui5/protocol` a semantic
version. A revision that only clarifies text or adds checks keeps the
protocol number; the conformance suite of a revision checks protocol 3 as
that revision describes it. Revisions 0.1 to 0.5 describe protocol 2. The
view profiles are versioned on their own:
the portable profile is v1 ([../profiles/portable.md](../profiles/portable.md)),
the semantic profile is snapshot v1 ([../profiles/semantic.md](../profiles/semantic.md)).
