# Workspace tooling instructions

## The LLM-judge tier

`just lint-llm-diff [base] [files...]` dispatches the cached Nx target
`tooling-workspace:lint-llm-diff`. Keep that dispatch cached: the judge is
non-deterministic, so a bare `llmlint --diff` samples it again on every worker
gate, publication gate, and CI run, and clearing the rule one sample reports
only changes which rule the next one fails.

The key must cover the whole workspace, the base resolved to a commit, the
judged file list, and a fingerprint of the judge configuration in force — the
installed llmlint version plus its effective merged config, so a rule change in
a plugin fetched from outside this repository invalidates it. Narrowing any of
those makes a green a claim about something no judge saw; a symbolic ref in
particular names a different diff the moment it advances.

Resolve that fingerprint in the judge's environment, never the caller's:
`llmlint config` renders the oneharness wrapper a dispatcher injects, and
reading it from the caller hashed one judged diff to a different key per
dispatch. The recipe computes it and passes it as an environment input rather
than declaring an Nx `runtime` input, because Nx scores a failing runtime input
as *no contribution* rather than as an error — which would drop the judge
configuration out of the key in silence. The target holds the recipe's answer to
what it resolves itself, so a disagreement fails the tier instead.

With no base argument, the base comes from the comparison identity a dispatch
already exported (`ONEVCS_COMPARISON_REMOTE` / `ONEVCS_COMPARISON_BASE`), so a
worker's gate and the publishing push that follows it judge one diff and share
one verdict. Never rediscover a default where that identity is present.

Only a green is recorded, because Nx caches successful tasks only: findings and
a toolchain that never reached a verdict both re-judge next time. A wrong green
sticks until the tree, the base commit, or the judge configuration moves, so
`just lint-llm-diff <base> --rejudge` is the one supported way to force a single
fresh judgement. Keep it per-invocation: an ambient `NX_SKIP_NX_CACHE` re-rolls
the judge from every unrelated command, so this tier reports and ignores it
while every other target still honours it.

Run `node scripts/workspace/llmlint-fingerprint.mjs` when a miss is
unexplained — a changed fingerprint over an unchanged tree is a changed judge,
not a changed diff.
