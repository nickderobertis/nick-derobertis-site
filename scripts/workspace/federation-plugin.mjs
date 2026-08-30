import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  declaredAppProjects,
  federationRemotes,
  readDeclaredProject,
} from "./federation-registry.mjs";

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
 *
 * A host owes a narrower dependency than that fan-in, and it is derived here
 * too. Each remote's build compiles its own exposes into declarations and
 * publishes the archive of them; a host's build consumes those archives and
 * type checks the sources it bundles against what it consumed. So a host is
 * built after the remotes it composes, and typechecked after its own build.
 * Which remotes those are is read from the `remoteMap` call in that host's own
 * rspack configuration, which is the one place a host declares them; naming
 * them again in a project.json would be the second list this plugin exists to
 * avoid.
 */

export const name = "nick-derobertis-site/federation";

const projectConfigurations = "apps/*/project.json";
const projectConfiguration = /^apps\/[a-z][a-z0-9-]*\/project\.json$/;
const federatedRemoteMap = /\bremoteMap\(\s*\[([\s\S]*?)\]/;
const federatedRemoteName = /"([a-z][a-z0-9-]*)"/g;

/**
 * The remotes one app composes, read from its own rspack configuration. An app
 * that federates nothing has no `remoteMap` call and owes no such dependency.
 *
 * A TypeScript source read by regex is text until something narrows it, so
 * every name it yields is held to `declared` — the remotes the workspace's own
 * project files declare — before it becomes an Nx dependency. What that
 * refuses is a name the extraction produced that no project answers to,
 * whether the configuration really names a remote that does not exist or the
 * pattern matched something that was never a remote list at all.
 */
function composedRemotes(source, declared) {
  const configuration = join(dirname(source), "rspack.config.ts");
  const composed = federatedRemoteMap.exec(readFileSync(configuration, "utf8"));
  if (composed === null) return [];
  const names = [...composed[1].matchAll(federatedRemoteName)].map(
    (match) => match[1],
  );
  if (names.length === 0)
    throw new Error(
      `${name} reads the remotes a host composes from the remoteMap call in ${configuration}, which names none. Pass each child remote there as a string literal and rerun just check.`,
    );
  const undeclared = names.filter((remote) => !declared.has(remote));
  if (undeclared.length > 0)
    throw new Error(
      `${name} read ${JSON.stringify(undeclared)} from the remoteMap call in ${configuration}, and no project declares metadata.federation.alias under that name. Name only declared remotes there and rerun just check.`,
    );
  return names;
}

// llmlint: ignore-block[changed_behavior_has_e2e] This derives the order Nx runs build, prerender, and screenshot in, and it runs while the project graph is being resolved — before rspack has built a single bundle, so there is no site, no route, and no page for a browser to load while it decides anything. What it returns is task scheduling and nothing else: it adds no module, changes no rendered markup, and is gone by the time the composed artifact exists, so a visitor observes only the same artifact the fan-in was already producing. federation-contract.spec.ts drives this exact entry point twice over: through the real `nx graph` for the fan-in every app ends up with, and directly for the file set Nx hands it. A configuration it refuses stops the graph before any build input is derived, so nothing is ever built for a browser to reach.
/** One entry per matched `project.json`, as `createNodesV2` returns them. */
function federationDependencies(configFiles) {
  // Nx matches this set against `projectConfigurations` and hands it straight
  // in, and every entry below is opened off disk, so the set is held to that
  // same pattern here rather than trusted because Nx is what produced it.
  if (
    !Array.isArray(configFiles) ||
    configFiles.some(
      (path) => typeof path !== "string" || !projectConfiguration.test(path),
    )
  )
    throw new Error(
      `${name} derives federation task dependencies from ${projectConfigurations} files, and was handed ${JSON.stringify(configFiles)}. Register this plugin with that pattern in nx.json and rerun just check.`,
    );
  const projects = configFiles.map(readDeclaredProject);
  const remoteBuilds = {
    target: "build",
    projects: federationRemotes(projects).map((remote) => remote.name),
  };
  // The compose step is named by the projects that declare it rather than by
  // the shell, so the host owning it stays a fact of that project's own file.
  const composeHosts = projects
    .filter((project) => project.targets.includes("prerender"))
    .map((project) => ({ target: "prerender", projects: [project.name] }));
  const composed = ["build", remoteBuilds];
  const captured = [...composed, ...composeHosts];
  // Read from the apps directory rather than from the handed set, because a
  // host composes remotes whether or not this call was handed their files.
  const declared = new Set(
    federationRemotes(declaredAppProjects()).map((remote) => remote.name),
  );
  return projects.map((project) => {
    const composedBuilds = composedRemotes(project.source, declared);
    const federated = composedBuilds.length
      ? [{ target: "build", projects: composedBuilds }]
      : [];
    const targets = {
      ...(project.targets.includes("screenshot")
        ? { screenshot: { dependsOn: captured } }
        : {}),
      ...(project.targets.includes("prerender")
        ? { prerender: { dependsOn: composed } }
        : {}),
      // A host consumes those declarations during its own build, so its
      // typecheck reads what that build wrote rather than reaching for the
      // remotes itself.
      ...(federated.length && project.targets.includes("typecheck")
        ? { typecheck: { dependsOn: ["build"] } }
        : {}),
      ...(federated.length && project.targets.includes("build")
        ? { build: { dependsOn: federated } }
        : {}),
    };
    return [
      project.source,
      Object.keys(targets).length === 0
        ? {}
        : { projects: { [dirname(project.source)]: { targets } } },
    ];
  });
}
// llmlint: ignore-end[changed_behavior_has_e2e]

export const createNodesV2 = [projectConfigurations, federationDependencies];
