/**
 * What `homeCards/Skeleton` has to resolve to under the config beside this
 * file. No manifest publishes a federation specifier, so nothing but the
 * caller's own `remotes` map can answer one; this export is how the probe
 * tells that map's answer from every other answer there is.
 */
export const standsInForARemote = true;
