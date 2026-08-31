# Home hydration-blocking decision

Measured 2026-08-31 against commit `1e5404a` after the staged CV payload and
federation-sharing work from issue #92.

## Question and decision threshold

Entering `/` imports `home/Page` before `hydrateRoot`, and Home in turn resolves
all seven pane `Page` modules before its module finishes evaluating. The wait
preserves the panes already present in the prerendered document instead of
temporarily replacing them with Suspense skeletons. This measurement asks
whether removing that wait now produces a meaningful reduction in Total
Blocking Time (TBT).

The threshold was fixed before looking at the result: removal is worthwhile
only if the experimental artifact's full observed TBT range is lower than, and
does not overlap, the current artifact's full observed range. A reduction whose
ranges overlap is `no change needed`. This is the same conservative range rule
used by the repository's performance report.

## Method

Two complete artifacts were composed locally with `shell:prerender`. The
baseline was built from `1e5404a` without source changes. For the experiment,
the single top-level statement

```ts
if (hydrateFromSource) resolved = await resolvePanes();
```

was replaced by a non-awaiting use of `hydrateFromSource`, and the complete
artifact was composed again. Each output was copied before the next build and
served from its own local HTTP origin at the production
`/nick-derobertis-site/` base path. This exercises the shell, Home host, all
seven federated pane containers, and the prerendered document the tree actually
publishes; no conclusion was inferred from bundle sizes.

The repository's `scripts/perf/performance-audit.mjs` drove Lighthouse 12.8.2
and its pinned Playwright Chromium 149 through `/` five times per artifact with
the desktop preset, simulated throttling, CPU slowdown multiplier 1, 40 ms RTT,
and 10,240 Kbps throughput. Both artifacts were measured sequentially on the
same Linux 6.17.0-1019-aws x64 host (Intel Xeon Platinum 8488C, 8 logical CPUs,
30.8 GiB RAM, Node 26.5.0). The raw TBT samples, in milliseconds, were:

| Artifact | Runs | Median | Observed range |
| --- | --- | ---: | ---: |
| Current hydration block | 5, 0, 2, 0, 0 | 0 | 0–5 |
| Experimental block removed | 2.5, 0, 1.5, 4, 0 | 1.5 | 0–4 |

As a cross-check that the browser reached the intended experimental bytes, its
JavaScript transfer was 3,186 bytes smaller (2,100,110 versus 2,103,296 bytes).
The document itself remained the same prerendered markup.

## Decision

Keep the hydration block. The experiment did not reduce median TBT, and its
0–4 ms range overlaps the current artifact's 0–5 ms range. It therefore does
not clear the predeclared threshold; the measured result is `no change needed`.
The experiment was reverted, so direct entry to `/` retains the existing
behavior: every prerendered pane remains in place while hydration starts, with
no skeleton replacing content already painted. The existing Home and shell
real-browser journeys remain the end-to-end proof of that finished behavior.
