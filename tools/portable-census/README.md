# Portable-profile census tools

The scripts that produced the census behind `profiles/portable.md` and
`profiles/portable-v1.json`, kept **as they were run** on 2026-10-03 - the
corpus roots at the top of `census.mjs` are the paths of that run (sibling
checkouts and cloned addon repositories); point them at your own checkouts
before running again.

Prerequisite: a copy of `@abap2ui5/linter` 0.8.5 `lib/` and `data/` in
`./lint`, with `lib/reconstruct.mjs` `resolveExpr` patched so the
event-handler branch returns `".eB('§" + Buffer.from(e).toString('base64url') + "§')"`
instead of `".eB()"` (the raw ABAP call survives and can be classified).

```bash
node census.mjs raw.json
node coverage.mjs raw.json v1.json cov_v1.json
node coverage.mjs raw.json v11.json cov_v11.json
node features.mjs v1.json features_v1.json
node features.mjs v11.json features_v11.json
node build.mjs portable-census && node merge.mjs
node gen-coverage.mjs            # -> coverage.md (profiles/portable-coverage.md)
node gen-proposal.mjs            # + proposal-head.md / proposal-tail.md -> portable-proposal.md
node ../../scripts/gen-portable-profile.mjs portable-proposal.md   # -> profiles/portable-v1.json
node ../../scripts/render-portable.mjs                              # -> profiles/portable.md sections
```

`v1.json` / `v11.json` are the control sets of profile v1 and of v1 plus the
v1.1 candidates, as the coverage scripts read them.
