import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import routeInput from "../apps/shell/src/routes.json" with { type: "json" };
import { siteRemoteNames as remoteNames } from "../libs/build-config/src/site-remotes.ts";
import { parseSiteRoutes } from "./site-contracts.mjs";

const output = "dist/apps/shell";
const base = "/nick-derobertis-site";
const routes = parseSiteRoutes(routeInput);
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
          route.remote
            ? React.createElement(
                "output",
                { className: "placeholder" },
                `${route.label} remote`,
              )
            : null,
          route.path === "/"
            ? React.createElement(
                "section",
                { className: "placeholder" },
                React.createElement("h2", null, "Awards"),
                React.createElement("p", null, "Selected awards"),
              )
            : null,
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
await cp("libs/data-access/vendor/codegen", join(output, "cv-data"), {
  recursive: true,
});

await rm(join(output, "remotes"), { recursive: true, force: true });
for (const name of remoteNames) {
  const destination = join(output, "remotes", name);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await cp(join("dist/apps", name), destination, { recursive: true });
    if (name === "awards") {
      const selectedDestination = join(destination, "selected");
      await mkdir(selectedDestination, { recursive: true });
      await cp(
        join(destination, "index.html"),
        join(selectedDestination, "index.html"),
      );
    }
  } catch (error) {
    throw new Error(
      `Cannot stage the ${name} remote; run \`pnpm exec nx run ${name}:build\` before prerendering.`,
      { cause: error },
    );
  }
}
