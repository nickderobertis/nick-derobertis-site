# Deployment performance comparison

Generated 2026-07-22T04:25:17.303Z with Lighthouse 12.8.2 using 5 runs per route. Timing values are the median of all runs; byte and score values are also medians for consistency.

> Absolute CPU- and network-bound timings are host-dependent because these audits run from a shared host against live deployments. Compare runs made on the same representative host. Transfer bytes and CLS deltas are substantially more stable.

## Methodology and environment

- Explicit Lighthouse preset: `desktop` (desktop form factor, `simulate` throttling)
- Applied throttling: `{"cpuSlowdownMultiplier":1,"rttMs":40,"throughputKbps":10240,"requestLatencyMs":0,"downloadThroughputKbps":0,"uploadThroughputKbps":0}`
- Host: Linux 6.17.0-1019-aws x64; Intel(R) Xeon(R) Platinum 8488C; 4 logical CPUs; 15.3 GiB RAM
- Runtime: v26.5.0; user agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36
- New deployment: https://nickderobertis.github.io/nick-derobertis-site/
- Original deployment: https://nickderobertis.com/

Lower is better for every metric except Performance score, where higher is better. Deltas are new minus original.

## `/`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 41 | 41 | 0 |
| FCP | 230 ms | 1914 ms | -1684 ms |
| LCP | 3928 ms | 2528 ms | +1400 ms |
| TBT | 1895 ms | 4588 ms | -2694 ms |
| CLS | 0.142 | 0.001 | +0.141 |
| Transfer | 3553.1 KiB | 3961.4 KiB | -408.3 KiB |
| JavaScript | 3545.1 KiB | 1694.0 KiB | +1851.1 KiB |

## `/bio`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 80 | 80 | 0 |
| FCP | 218 ms | 1723 ms | -1505 ms |
| LCP | 793 ms | 2068 ms | -1275 ms |
| TBT | 1 ms | 121 ms | -119 ms |
| CLS | 0.442 | 0.000 | +0.442 |
| Transfer | 448.9 KiB | 2111.7 KiB | -1662.8 KiB |
| JavaScript | 443.7 KiB | 1364.2 KiB | -920.5 KiB |

## `/research`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 35 | 66 | -31 |
| FCP | 259 ms | 1780 ms | -1521 ms |
| LCP | 3068 ms | 2100 ms | +968 ms |
| TBT | 587 ms | 142 ms | +445 ms |
| CLS | 0.985 | 0.240 | +0.745 |
| Transfer | 3137.7 KiB | 2032.9 KiB | +1104.8 KiB |
| JavaScript | 883.4 KiB | 1364.4 KiB | -481.0 KiB |

## `/software`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 30 | 40 | -10 |
| FCP | 267 ms | 1815 ms | -1549 ms |
| LCP | 2217 ms | 2466 ms | -249 ms |
| TBT | 1164 ms | 339 ms | +824 ms |
| CLS | 0.883 | 0.528 | +0.354 |
| Transfer | 920.2 KiB | 2422.7 KiB | -1502.5 KiB |
| JavaScript | 881.9 KiB | 1364.4 KiB | -482.5 KiB |

## `/courses`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 43 | 72 | -29 |
| FCP | 236 ms | 1737 ms | -1501 ms |
| LCP | 1857 ms | 2310 ms | -453 ms |
| TBT | 648 ms | 109 ms | +540 ms |
| CLS | 0.985 | 0.158 | +0.827 |
| Transfer | 887.4 KiB | 2672.8 KiB | -1785.4 KiB |
| JavaScript | 882.6 KiB | 1364.4 KiB | -481.8 KiB |

