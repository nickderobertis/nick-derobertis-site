# Deployment performance comparison

Generated 2026-07-28T05:00:24.859Z with Lighthouse 12.8.2 using 5 runs per route. Timing values are the median of all runs; byte and score values are also medians for consistency.

> Absolute CPU- and network-bound timings are host-dependent because these audits run from a shared host against live deployments. Compare runs made on the same representative host. Transfer bytes and CLS deltas are substantially more stable.

## Methodology and environment

- Explicit Lighthouse preset: `desktop` (desktop form factor, `simulate` throttling)
- Applied throttling: `{"cpuSlowdownMultiplier":1,"rttMs":40,"throughputKbps":10240,"requestLatencyMs":0,"downloadThroughputKbps":0,"uploadThroughputKbps":0}`
- Host: Linux 6.8.0-136-generic arm64; unknown; 14 logical CPUs; 29.3 GiB RAM
- Runtime: v26.5.0; user agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36
- New deployment: https://nickderobertis.github.io/nick-derobertis-site/
- Original deployment: https://nickderobertis.com/

Lower is better for every metric except Performance score, where higher is better. Deltas are new minus original.

## `/`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 97 | 73 | +24 |
| FCP | 304 ms | 1881 ms | -1577 ms |
| LCP | 427 ms | 2965 ms | -2538 ms |
| TBT | 148 ms | 25 ms | +123 ms |
| CLS | 0.000 | 0.001 | -0.001 |
| Transfer | 3421.4 KiB | 4108.4 KiB | -687.0 KiB |
| JavaScript | 3391.1 KiB | 1693.5 KiB | +1697.7 KiB |

## `/bio`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 100 | 82 | +18 |
| FCP | 257 ms | 1420 ms | -1163 ms |
| LCP | 382 ms | 2420 ms | -2038 ms |
| TBT | 38 ms | 19 ms | +19 ms |
| CLS | 0.000 | 0.000 | -0.000 |
| Transfer | 61.8 KiB | 2272.4 KiB | -2210.6 KiB |
| JavaScript | 55.7 KiB | 1363.7 KiB | -1307.9 KiB |

## `/research`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 90 | 70 | +20 |
| FCP | 258 ms | 1421 ms | -1163 ms |
| LCP | 2127 ms | 2338 ms | -211 ms |
| TBT | 57 ms | 20 ms | +38 ms |
| CLS | 0.000 | 0.240 | -0.240 |
| Transfer | 2733.9 KiB | 2179.6 KiB | +554.3 KiB |
| JavaScript | 478.1 KiB | 1363.7 KiB | -885.6 KiB |

## `/software`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 100 | 63 | +37 |
| FCP | 541 ms | 1508 ms | -967 ms |
| LCP | 660 ms | 1980 ms | -1320 ms |
| TBT | 52 ms | 19 ms | +33 ms |
| CLS | 0.000 | 0.529 | -0.529 |
| Transfer | 824.7 KiB | 2569.5 KiB | -1744.8 KiB |
| JavaScript | 477.6 KiB | 1364.0 KiB | -886.4 KiB |

## `/courses`

| Metric | New | Original | Delta |
| --- | ---: | ---: | ---: |
| Performance | 100 | 72 | +28 |
| FCP | 258 ms | 1424 ms | -1166 ms |
| LCP | 382 ms | 2946 ms | -2563 ms |
| TBT | 65 ms | 20 ms | +45 ms |
| CLS | 0.000 | 0.158 | -0.158 |
| Transfer | 489.2 KiB | 2819.6 KiB | -2330.5 KiB |
| JavaScript | 478.3 KiB | 1364.0 KiB | -885.6 KiB |

