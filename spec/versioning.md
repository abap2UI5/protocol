# Versioning

## The protocol number

Every response declares the wire it speaks as `S_FRONT.PROTOCOL`, an
integer - **2** today ([TY] `c_protocol`, stamped by [H]
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

The number is not the product version (`z2ui5_if_app=>version`, 1.149.0)
and does not move with a release. It moves when a response can no longer be
read by a frontend written for the previous number - the `S_ACTION`
envelope replacing `S_FRONT.PARAMS` was such a change (protocol 2), and so
was the flattening of the bound attributes out of `MODEL.XX`. Both halves are
raised in the change that breaks the wire.

Why it exists: backend and frontend ship together in abap2UI5, but not
everywhere - a port of the framework, a pinned webapp, a third-party shell
pair them across ages, and without the number the failure was a page that
rendered nothing with no error anywhere.

## Compatible changes within protocol 2

These do not change the number, and every implementation MUST tolerate
them:

- a new optional key in `S_FRONT`, in an action's option object, in a
  `CONFIG` block (request) or in the snapshot (semantic profile);
- a new follow-up action, or a new global target of `CONTROL_GLOBAL` - a
  frontend that does not know it skips it ([actions.md](actions.md));
- a new slot option;
- a new `ROUTER` option;
- a new reserved key of `MODEL` and a new reserved event name - `__WINDOW`
  and `___ZZZ_WIN` of [windowed-tables.md](windowed-tables.md), revision
  0.5: a frontend that knows neither reads a windowed table as a short one
  and never sends the event, a backend that knows neither never sends the
  key.

These DO break the wire and need a new protocol number: renaming or removing
a key; changing a key's type or meaning; changing the shape of an action
array; adding a system action a frontend must run for the screen to be
right.

**The app-driven window is such a change, and the number stays 2 for
now.** abap2UI5 after 1.150.0 (main `694fb262`, #3032) gives the arguments of
`___ZZZ_WIN` another shape and meaning - `[path, event, reason, skip,
top, ...]` handed to the app instead of `[path, count, sort?, filter?]`
answered by the backend - and the rows of a `__delta` on a windowed table
another meaning (rows of the table, no longer positions in the backend's
order); `__WINDOW` gains `EVENT`
([windowed-tables.md](windowed-tables.md)). A frontend of 1.149.0 and a
backend after it, or the other way round, misread each other's window
requests without an error: the app gets an event named after a count, or
the backend reads `"ROWS"` as a count. `c_protocol` and the frontend's
`PROTOCOL` stay 2 on main ([TY], [SRV]), the window of 1.149.0
was released on 2026-11-16 and replaced within days, and this revision
follows the implementation - whether that is right, or whether the
change asks for protocol 3, is
[open question 15](open-questions.md#15-the-app-driven-window-and-the-protocol-number).

## This specification's own version

The specification has a revision of its own (0.5, see
[README.md](README.md)), and the package `@abap2ui5/protocol` a semantic
version. A revision that only clarifies text or adds checks keeps the
protocol number; the conformance suite of a revision checks protocol 2 as
that revision describes it. The view profiles are versioned on their own:
the portable profile is v1 ([../profiles/portable.md](../profiles/portable.md)),
the semantic profile is snapshot v1 ([../profiles/semantic.md](../profiles/semantic.md)).
