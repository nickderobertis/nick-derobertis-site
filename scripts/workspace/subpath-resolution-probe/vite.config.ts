// The subject subpath-resolution.spec.ts drives its test-runner half against: a
// component config the shared harness produced, which is the configuration
// every app and library is tested under. The specifiers the probe beside this
// file imports have to resolve through that harness rather than through the
// hand-written node configs the tooling projects use, so the probe runs under
// its own harness-produced config rather than beside the contract that drives
// it. It belongs to no Nx project and is run by that contract alone.
//
// Everything this config is made of lives in `probe-config.ts`; this file is
// only the choice of which order the `remotes` map is stated in.
import { probeConfig, probeRemotes } from "./probe-config";

export default probeConfig(probeRemotes);
