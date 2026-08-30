/**
 * What `@site/build-config/remote-registry` has to resolve to under the config
 * beside this file, which states it as a remote. `@site/build-config` publishes
 * that same subpath, so both could answer; the caller's map is the one that has
 * to, and this export is how the probe tells the two apart.
 */
export const shadowsAPublishedSubpath = true;
