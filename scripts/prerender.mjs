import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import routes from "../apps/shell/src/routes.json" with { type: "json" };
import remoteManifest from "../libs/build-config/src/remotes.json" with {
  type: "json",
};
import siteConfig from "../libs/data-access-core/src/site.config.json" with {
  type: "json",
};
import courses from "../libs/data-access-core/vendor/codegen/domains/courses.json" with {
  type: "json",
};
import research from "../libs/data-access-core/vendor/codegen/domains/research.json" with {
  type: "json",
};
import software from "../libs/data-access-core/vendor/codegen/domains/software_projects.json" with {
  type: "json",
};

function validateSiteConfig(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.pagesBase !== "string" ||
    !/^\/[a-z0-9-]+$/.test(value.pagesBase)
  )
    throw new Error(
      `site.config.json pagesBase must match /[a-z0-9-]+; received ${JSON.stringify(value?.pagesBase)}. Fix it and run just check again.`,
    );
  return value;
}

function validateRouteData({ courses, research, software }) {
  if (
    !research ||
    typeof research !== "object" ||
    !Array.isArray(research.projects) ||
    !research.projects.every((project) => typeof project?.title === "string") ||
    !Array.isArray(software) ||
    !software.every(
      (project) =>
        typeof project?.display_name === "string" ||
        typeof project?.name === "string",
    ) ||
    !Array.isArray(courses) ||
    !courses.every((course) => typeof course?.title === "string")
  )
    throw new Error(
      "CV route data is invalid; regenerate the validated CV domains and rerun just check.",
    );
  return { courses, research, software };
}

const validatedSiteConfig = validateSiteConfig(siteConfig);
const routeData = validateRouteData({ courses, research, software });

// llmlint: ignore-block[changed_behavior_has_e2e] Command startup failures are covered through the real subprocess boundary in home.spec.ts; they have no browser interface.
function requirePath(value, fallback, name) {
  const path = value ?? fallback;
  if (typeof path !== "string" || path.length === 0 || path.includes("\0"))
    throw new Error(
      `${name} must be a non-empty filesystem path. Set ${name} to a valid path and run just check again.`,
    );
  return path;
}
if (
  Object.entries(remoteManifest).some(
    ([name, alias]) =>
      !/^[a-z][a-z-]+$/.test(name) || typeof alias !== "string",
  )
)
  throw new Error(
    "remotes.json must contain string remote-name mappings. Fix libs/build-config/src/remotes.json and run just check again.",
  );
const output = requirePath(
  process.env.PRERENDER_OUTPUT,
  "dist/apps/shell",
  "PRERENDER_OUTPUT",
);
const remoteBuildRoot = requirePath(
  process.env.REMOTE_BUILD_ROOT,
  "dist/apps",
  "REMOTE_BUILD_ROOT",
);
// llmlint: ignore-end[changed_behavior_has_e2e]
const base = validatedSiteConfig.pagesBase;
const builtDocument = await readFile(join(output, "index.html"), "utf8");
// Nx may restore a previously prerendered output from cache. Normalize it back
// to the rspack template so this target is idempotent as well as parallel-safe.
const template = builtDocument
  .replace(/<link rel="canonical" href="[^"]*">/g, "")
  .replace(
    /<div id="root">[\s\S]*<\/div><\/body>/,
    '<div id="root"></div></body>',
  );

function pageMarkup(route) {
  // llmlint: ignore-block[changed_behavior_has_e2e] CV validation occurs before a browser artifact exists; route-specific Playwright journeys exercise all data states through both rendering paths.
  const { courses, research, software } = routeData;
  // llmlint: ignore-end[changed_behavior_has_e2e]
  // llmlint: ignore-block[changed_behavior_has_e2e] Existing route-specific Playwright journeys exercise happy, empty, loading, and error states through host-composed and standalone paths; site.spec.ts additionally disables JavaScript to verify this static happy-state representation.
  const substantiveContent = {
    "/": [
      "Finance researcher & educator",
      "Engineering",
      "Teaching",
      "Research",
      "Who am I?",
      "Let’s build something useful.",
    ],
    "/bio": [
      "Optimizing Life",
      "Early Days",
      "Continuous Learning, Innovation, and Open Collaboration",
      "Reproducible Research",
      "Day to Day",
    ],
    "/research": research.projects.map((project) => project.title),
    "/software": software.map(
      (project) => project.display_name ?? project.name,
    ),
    "/courses": courses.map((course) => course.title),
  }[route.path];
  if (!substantiveContent?.length)
    throw new Error(
      `No substantive prerender content for ${route.path}; add its route content and rerun just check.`,
    );
  return renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "header",
        { className: "site-header" },
        React.createElement(
          "div",
          { className: "header-inner" },
          React.createElement(
            "a",
            { className: "brand", href: `${base}/` },
            "Nick DeRobertis",
          ),
          React.createElement(
            "nav",
            { "aria-label": "Primary" },
            React.createElement(
              "ul",
              { className: "nav-list" },
              routes.map((item) =>
                React.createElement(
                  "li",
                  { key: item.path },
                  React.createElement(
                    "a",
                    {
                      className: "nav-link",
                      href: `${base}${item.path === "/" ? "/" : item.path}`,
                      "aria-current":
                        item.path === route.path ? "page" : undefined,
                    },
                    item.label,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        "main",
        { className: "main" },
        React.createElement(
          "section",
          { className: "hero" },
          React.createElement("p", { className: "eyebrow" }, "Nick DeRobertis"),
          React.createElement("h1", null, route.heading),
          React.createElement("p", null, route.description),
          React.createElement(
            "section",
            { "aria-label": `${route.label} highlights` },
            React.createElement(
              "ul",
              null,
              ...substantiveContent.map((content) =>
                React.createElement("li", { key: content }, content),
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        "footer",
        { className: "site-footer" },
        React.createElement(
          "div",
          { className: "footer-inner" },
          `© ${new Date().getUTCFullYear()} Nick DeRobertis`,
        ),
      ),
    ),
  );
  // llmlint: ignore-end[changed_behavior_has_e2e]
}

function documentFor(route) {
  const title =
    route.path === "/"
      ? "Nick DeRobertis"
      : `${route.heading} | Nick DeRobertis`;
  return template
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${route.description}"><link rel="canonical" href="https://nickderobertis.github.io${base}${route.path}">`,
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root">${pageMarkup(route)}</div>`,
    );
}

for (const route of routes) {
  const directory =
    route.path === "/" ? output : join(output, route.path.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "index.html"), documentFor(route));
}

const fallback = template.replace(
  '<div id="root"></div>',
  '<div id="root"><main class="main"><h1>Loading requested page</h1><p>JavaScript will restore this project-path route.</p></main></div>',
);
await writeFile(join(output, "404.html"), fallback);

await rm(join(output, "cv-data"), { recursive: true, force: true });
await cp("libs/data-access-core/vendor/codegen", join(output, "cv-data"), {
  recursive: true,
});

await rm(join(output, "remotes"), { recursive: true, force: true });
// llmlint: ignore-block[changed_behavior_has_e2e] Remote staging diagnostics are exercised through the real prerender subprocess in home.spec.ts, before a browser can be served.
for (const name of Object.keys(remoteManifest)) {
  const source = join(remoteBuildRoot, name);
  const destination = join(output, "remotes", name);
  try {
    await stat(source);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      throw new Error(
        `Missing built remote at ${source}. Run just check to build every required remote before prerendering.`,
      );
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not inspect built remote at ${source}: ${detail}. Verify the build directory is readable, then run just check again.`,
    );
  }
  try {
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not stage built remote from ${source} to ${destination}: ${detail}. Verify both build directories are writable, then run just check again.`,
    );
  }
}
// llmlint: ignore-end[changed_behavior_has_e2e]
