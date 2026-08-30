// The same component config as `vite.config.ts` beside this file, differing in
// one thing only: the `remotes` map states its entries in the opposite order.
// That map is the last ordered map any resolution in this workspace still
// depends on — the `paths` map whose key order used to decide which of two
// overlapping aliases won is gone — so `subpath-resolution.spec.ts` runs the
// probe under both configs and every answer the probe reads has to be the same
// one under each. Neither file restates what the config is made of: both read
// it from `probe-config.ts`, so the reversal below is the only difference
// there is to have.
import { probeConfig, probeRemotes, reversed } from "./probe-config";

export default probeConfig(reversed(probeRemotes));
