import { dirname } from "node:path";
import { declaredProject, federationRemotes } from "./federation-registry.mjs";

/**
 * Derives the federation task dependencies every app owes the composed site.
 *
 * `shell:prerender` composes the whole site in place over `dist/apps/shell`,
 * and the e2e server serves those composed bytes, so every remote's build
 * genuinely is a prerequisite of every app's `screenshot` and of the compose
 * itself. That fan-in used to be written down twice — once in `nx.json`'s
 * `targetDefaults.screenshot.dependsOn` and once in `apps/shell/project.json`'s
 * `prerender.dependsOn` — as two hand-kept lists of the same twelve remotes.
 * Here it is read out of the remotes themselves: a project declaring
 * `metadata.federation.alias` is a remote, so a remote added tomorrow is a
 * prerequisite the day it is added rather than when someone remembers both
 * lists.
 *
 * `createNodesV2` hands the whole matched file set to one call, which is what
 * makes this possible: a dependency on every remote cannot be derived from one
 * project's file in isolation.
 */

export const name = "nick-derobertis-site/federation";

const projectConfigurations = "apps/*/project.json";

/**
 * @param {readonly string[]} configFiles
 * @returns {import("nx/dist/src/project-graph/plugins/public-api").CreateNodesResultArray}
 */
function federationDependencies(configFiles) {
  const projects = configFiles.map(declaredProject);
  const remoteBuilds = {
    target: "build",
    projects: federationRemotes(projects).map((remote) => remote.name),
  };
  // The compose step is named by the projects that declare it rather than by
  // the shell, so the host owning it stays a fact of that project's own file.
  const composeHosts = projects
    .filter((project) => project.configuration.targets?.prerender)
    .map((project) => ({ target: "prerender", projects: [project.name] }));
  const composed = ["build", remoteBuilds];
  const captured = [...composed, ...composeHosts];
  return projects.map((project) => {
    const declared = project.configuration.targets ?? {};
    const targets = {
      ...(declared.screenshot ? { screenshot: { dependsOn: captured } } : {}),
      ...(declared.prerender ? { prerender: { dependsOn: composed } } : {}),
    };
    return [
      project.source,
      Object.keys(targets).length === 0
        ? {}
        : { projects: { [dirname(project.source)]: { targets } } },
    ];
  });
}

export const createNodesV2 = [projectConfigurations, federationDependencies];
