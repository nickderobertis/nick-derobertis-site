# Deployment performance comparison

Generated 2026-08-03T18:52:51.431Z with Lighthouse 12.8.2 using 5 runs per route. Every table reports the median and the full observed min–max spread from this single paired capture.

> Performance score, FCP, LCP, and TBT are host-sensitive. Transfer bytes, JavaScript bytes, and CLS are substantially stable across hosts. All comparisons below use only this capture, in which both sites were measured on the same host.

## Methodology and environment

- Explicit Lighthouse preset: `desktop` (desktop form factor, `simulate` throttling)
- Applied throttling: `{"cpuSlowdownMultiplier":1,"rttMs":40,"throughputKbps":10240,"requestLatencyMs":0,"downloadThroughputKbps":0,"uploadThroughputKbps":0}`
- Host: Linux 6.17.0-1019-aws x64; Intel(R) Xeon(R) Platinum 8488C; 8 logical CPUs; 30.8 GiB RAM
- Runtime: v26.5.0; user agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36
- New deployment: https://nickderobertis.github.io/nick-derobertis-site/
- Original deployment: https://nickderobertis.com/

Five runs were retained. They were sufficient because each median was supported by the clustered majority even where a single run widened a range; stable metrics were otherwise tightly grouped, and conservative range overlap prevents claims from noisy host-sensitive results.

The 2026-07-22 committed capture and PR #56's 2026-07-28 capture are superseded. They predate the current fragment-composition and independent-deploy architecture, and they were taken on different hosts; the unchanged control site's large score movement demonstrates that cross-host timing and score conclusions are confounded. PR #56 must not be merged.

Lower is better for every metric except Performance score, where higher is better. Deltas are median new minus median original. A conclusion is made only when the observed ranges do not overlap; overlapping ranges are reported as not distinguishable.

## Plain-language findings

Every route has a mixed result rather than an unqualified winner:

- `/`: mixed — Performance not distinguishable from the observed spread; FCP better; LCP better; TBT worse; CLS not distinguishable from the observed spread; Transfer not distinguishable from the observed spread; JavaScript worse.
- `/bio`: mixed — Performance better; FCP better; LCP better; TBT not distinguishable from the observed spread; CLS not distinguishable from the observed spread; Transfer better; JavaScript better.
- `/research`: mixed — Performance better; FCP better; LCP not distinguishable from the observed spread; TBT worse; CLS better; Transfer not distinguishable from the observed spread; JavaScript better.
- `/software`: mixed — Performance better; FCP better; LCP better; TBT worse; CLS better; Transfer better; JavaScript better.
- `/courses`: mixed — Performance better; FCP better; LCP better; TBT worse; CLS better; Transfer better; JavaScript better.

The transfer, JavaScript, and CLS findings survive a change of measurement machine. In particular, Home's roughly doubled JavaScript payload is a real regression, while the four route pages' smaller JavaScript payloads and the new deployment's zero CLS are real wins where their displayed ranges separate. Performance, FCP, LCP, and TBT findings apply only to this same-host capture.

## `/`

| Metric | New median (range) | Original median (range) | Median delta |
| --- | ---: | ---: | ---: |
| Performance | 74 (74–75) | 69 (50–75) | +5 |
| FCP | 260 ms (259 ms–296 ms) | 1924 ms (1803 ms–2421 ms) | -1664 ms |
| LCP | 461 ms (360 ms–463 ms) | 2485 ms (2364 ms–4200 ms) | -2024 ms |
| TBT | 699 ms (690 ms–733 ms) | 216 ms (162 ms–330 ms) | +483 ms |
| CLS | 0.000 (0.000–0.000) | 0.000 (0.000–0.009) | -0.000 |
| Transfer | 3421.7 KiB (3421.7 KiB–3995.7 KiB) | 3962.2 KiB (3962.1 KiB–5139.9 KiB) | -540.5 KiB |
| JavaScript | 3391.5 KiB (3391.2 KiB–3958.7 KiB) | 1695.0 KiB (1694.9 KiB–2226.2 KiB) | +1696.5 KiB |

**Evidence-based result:** Performance: not distinguishable from the observed spread; FCP: better; LCP: better; TBT: worse; CLS: not distinguishable from the observed spread; Transfer: not distinguishable from the observed spread; JavaScript: worse.

## `/bio`

| Metric | New median (range) | Original median (range) | Median delta |
| --- | ---: | ---: | ---: |
| Performance | 98 (97–99) | 82 (69–83) | +16 |
| FCP | 212 ms (212 ms–223 ms) | 1688 ms (1682 ms–2167 ms) | -1476 ms |
| LCP | 432 ms (417 ms–448 ms) | 2012 ms (2003 ms–3151 ms) | -1580 ms |
| TBT | 135 ms (119 ms–140 ms) | 55 ms (55 ms–124 ms) | +80 ms |
| CLS | 0.000 (0.000–0.000) | 0.000 (0.000–0.000) | -0.000 |
| Transfer | 46.1 KiB (46.1 KiB–46.2 KiB) | 2112.7 KiB (2112.5 KiB–3286.5 KiB) | -2066.7 KiB |
| JavaScript | 40.0 KiB (40.0 KiB–40.1 KiB) | 1365.2 KiB (1365.2 KiB–1894.3 KiB) | -1325.2 KiB |

**Evidence-based result:** Performance: better; FCP: better; LCP: better; TBT: not distinguishable from the observed spread; CLS: not distinguishable from the observed spread; Transfer: better; JavaScript: better.

## `/research`

| Metric | New median (range) | Original median (range) | Median delta |
| --- | ---: | ---: | ---: |
| Performance | 85 (79–86) | 71 (57–71) | +14 |
| FCP | 216 ms (214 ms–229 ms) | 1648 ms (1643 ms–2127 ms) | -1432 ms |
| LCP | 2083 ms (2081 ms–2600 ms) | 1984 ms (1951 ms–3037 ms) | +99 ms |
| TBT | 183 ms (171 ms–219 ms) | 55 ms (55 ms–130 ms) | +129 ms |
| CLS | 0.000 (0.000–0.000) | 0.240 (0.240–0.240) | -0.240 |
| Transfer | 2734.4 KiB (2734.3 KiB–2734.4 KiB) | 2033.7 KiB (2033.4 KiB–3207.6 KiB) | +700.7 KiB |
| JavaScript | 478.5 KiB (478.4 KiB–478.7 KiB) | 1365.2 KiB (1364.9 KiB–1894.3 KiB) | -886.7 KiB |

**Evidence-based result:** Performance: better; FCP: better; LCP: not distinguishable from the observed spread; TBT: worse; CLS: better; Transfer: not distinguishable from the observed spread; JavaScript: better.

## `/software`

| Metric | New median (range) | Original median (range) | Median delta |
| --- | ---: | ---: | ---: |
| Performance | 93 (93–95) | 58 (46–59) | +35 |
| FCP | 523 ms (522 ms–534 ms) | 1645 ms (1638 ms–2126 ms) | -1121 ms |
| LCP | 548 ms (538 ms–723 ms) | 2346 ms (2305 ms–3315 ms) | -1797 ms |
| TBT | 206 ms (188 ms–216 ms) | 77 ms (69 ms–129 ms) | +129 ms |
| CLS | 0.000 (0.000–0.000) | 0.526 (0.526–0.529) | -0.526 |
| Transfer | 825.2 KiB (825.1 KiB–825.2 KiB) | 2423.9 KiB (2423.7 KiB–3597.7 KiB) | -1598.8 KiB |
| JavaScript | 477.9 KiB (477.8 KiB–478.0 KiB) | 1365.2 KiB (1365.2 KiB–1894.3 KiB) | -887.3 KiB |

**Evidence-based result:** Performance: better; FCP: better; LCP: better; TBT: worse; CLS: better; Transfer: better; JavaScript: better.

## `/courses`

| Metric | New median (range) | Original median (range) | Median delta |
| --- | ---: | ---: | ---: |
| Performance | 92 (92–93) | 74 (59–75) | +18 |
| FCP | 216 ms (214 ms–232 ms) | 1643 ms (1535 ms–2134 ms) | -1427 ms |
| LCP | 426 ms (424 ms–436 ms) | 2261 ms (2206 ms–3599 ms) | -1834 ms |
| TBT | 229 ms (223 ms–236 ms) | 55 ms (52 ms–136 ms) | +175 ms |
| CLS | 0.000 (0.000–0.000) | 0.158 (0.158–0.158) | -0.158 |
| Transfer | 489.6 KiB (489.5 KiB–489.6 KiB) | 2673.6 KiB (2673.2 KiB–3847.5 KiB) | -2184.0 KiB |
| JavaScript | 478.7 KiB (478.7 KiB–478.8 KiB) | 1365.2 KiB (1365.0 KiB–1894.2 KiB) | -886.6 KiB |

**Evidence-based result:** Performance: better; FCP: better; LCP: better; TBT: worse; CLS: better; Transfer: better; JavaScript: better.

