import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { fragmentContractSchema } from "../libs/build-config/src/fragment-contract.ts";
import remoteManifest from "../libs/build-config/src/remotes.json" with {
  type: "json",
};
import siteConfig from "../libs/data-access-core/src/site.config.json" with {
  type: "json",
};
import { inlineRemoteCssPattern } from "./remote-css.mjs";
import { parseRemoteManifest, routeContracts } from "./route-contracts.mjs";

const validatedRemoteManifest = parseRemoteManifest(remoteManifest);
const appNames = ["shell", ...Object.keys(validatedRemoteManifest)];
export const homePanes = [
  "home-carousel",
  "home-cards",
  "home-story",
  "skills",
  "awards",
  "home-contact",
  "timeline",
];
export const routeFragments = {
  "/": [
    "home",
    "home-carousel",
    "home-cards",
    "home-story",
    "home-contact",
    "timeline",
    "skills",
    "awards",
  ],
  "/bio": ["bio"],
  "/research": ["research"],
  "/software": ["software"],
  "/courses": ["courses"],
};
function validatedPagesBase(value) {
  if (typeof value !== "string" || !/^\/[a-z0-9-]+$/.test(value))
    throw new Error(
      `site.config.json pagesBase must match /[a-z0-9-]+; received ${JSON.stringify(value)}. Fix the site config and rerun just prerender.`,
    );
  return value;
}

const pagesBase = validatedPagesBase(siteConfig.pagesBase);

function decodeShellMetadata(element, attribute, label) {
  const encoded = element.getAttribute(attribute);
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
    throw new Error(
      `The shell fragment has invalid ${label} metadata. Rebuild the shell fragment and rerun just prerender.`,
    );
  return Buffer.from(encoded, "base64").toString();
}

function validatedTextMetadata(value, label) {
  if (value.length === 0 || value.length > 300 || /[\0<>"&]/.test(value))
    throw new Error(
      `The shell fragment has unsafe ${label} metadata. Fix the route manifest, rebuild the shell, and rerun just prerender.`,
    );
  return value;
}

export function validatedHydrationMetadata(value, routePath) {
  const nulSentinel = "__PUBLISHED_FRAGMENT_NUL__";
  if (value.includes(nulSentinel))
    throw new Error(
      `The shell fragment has ambiguous router hydration for ${routePath}. Rebuild the shell fragment and rerun just prerender.`,
    );
  const dom = new JSDOM(`<body>${value.replaceAll("\0", nulSentinel)}</body>`);
  const children = [...dom.window.document.body.children];
  const script = children[0];
  const violations = [
    children.length !== 1 && `expected one element, found ${children.length}`,
    script?.tagName !== "SCRIPT" && "the sole element is not a script",
    script?.attributes.length !== 0 && "the hydration script has attributes",
    !script?.textContent?.includes("$_TSR.router=") &&
      "the hydration script lacks $_TSR.router assignment",
    !script?.textContent?.includes("$_TSR.e()") &&
      "the hydration script lacks $_TSR.e() completion",
  ].filter(Boolean);
  if (violations.length > 0)
    throw new Error(
      `The shell fragment has invalid router hydration for ${routePath}: ${violations.join("; ")}. Rebuild the shell fragment and rerun just prerender.`,
    );
  return script.outerHTML.replaceAll(nulSentinel, "\0");
}

function requiredPath(value, fallback, label) {
  const path = value ?? fallback;
  if (typeof path !== "string" || path.length === 0 || path.includes("\0"))
    throw new Error(
      `${label} must be a non-empty filesystem path. Set it to a readable artifact directory and rerun just prerender.`,
    );
  return path;
}

// llmlint: ignore-block[changed_behavior_has_e2e] Version skew prevents composition before any page can be served, so compose.spec.ts exercises this exported CLI boundary directly; site.spec.ts and every feature journey exercise matching contracts through the real assembled browser artifact.
export function validateFragmentContracts(contracts) {
  if (!Array.isArray(contracts) || contracts.length < 2)
    throw new Error(
      "Compose requires at least two published fragment contracts. Build or fetch the shell and remote fragments, then rerun just prerender.",
    );
  const parsed = contracts.map((contract, index) => {
    const result = fragmentContractSchema.safeParse(contract);
    if (!result.success)
      throw new Error(
        `Published fragment contract ${index + 1} is invalid: ${result.error.issues.map((issue) => `${issue.path.join(".") || "contract"} ${issue.message}`).join("; ")}. Rebuild that app with the current fragment schema, then rerun just prerender.`,
      );
    return result.data;
  });
  for (const contract of parsed) {
    if (!appNames.includes(contract.name))
      throw new Error(
        `Published fragment contract declares unknown app ${contract.name}. Align it with remotes.json and rerun just prerender.`,
      );
  }
  const expected = parsed[0];
  for (const contract of parsed.slice(1)) {
    if (
      contract.react !== expected.react ||
      contract.reactDom !== expected.reactDom
    )
      throw new Error(
        `React version skew: ${expected.name} declares react ${expected.react} and react-dom ${expected.reactDom}, but ${contract.name} declares react ${contract.react} and react-dom ${contract.reactDom}. Publish every app with matching React dependencies, then rerun just prerender.`,
      );
  }
  return parsed;
}
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] This normalization turns React's completed streamed boundary into the stable DOM React hydrates; site.spec.ts exercises the assembled result through hydration, and every feature journey drives the normalized markup through standalone and host-composed browser paths.
function finalizeReactPrerender(html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document, Node } = dom.window;
  for (const template of document.querySelectorAll('template[id^="B:"]')) {
    const boundaryId = template.id;
    const contentId = boundaryId.replace("B:", "S:");
    const content = document.getElementById(contentId);
    if (!content) continue;
    const opening = template.previousSibling;
    if (opening?.nodeType === Node.COMMENT_NODE) opening.nodeValue = "$";
    while (content.firstChild)
      template.parentNode?.insertBefore(content.firstChild, template);
    template.remove();
    const instruction = content.nextElementSibling;
    content.remove();
    if (
      instruction?.tagName === "SCRIPT" &&
      instruction.textContent?.includes(`$RC("${boundaryId}","${contentId}")`)
    )
      instruction.remove();
  }
  return document.body.innerHTML;
}
// llmlint: ignore-end[changed_behavior_has_e2e]

function replaceSlot(markup, name, fragment) {
  const dom = new JSDOM(`<body>${markup}</body>`);
  const slot = dom.window.document.querySelector(
    `template[data-published-fragment="${name}"]`,
  );
  if (!slot)
    throw new Error(
      `The published parent markup has no ${name} fragment slot. Rebuild its owning shell or Home fragment, then rerun just prerender.`,
    );
  slot.outerHTML = fragment;
  return dom.window.document.body.innerHTML;
}

// llmlint: ignore-block[changed_behavior_has_e2e] Published-input rejection happens before a browser artifact exists and compose.spec.ts exercises that real CLI boundary; site.spec.ts drives successful assembled routes with JavaScript disabled and through hydration, preload.spec.ts covers deferral, and every journey spec drives both standalone and host-composed artifact boundaries.
export async function compose({
  fragmentRoot = "dist/apps",
  output = "dist/apps/shell",
} = {}) {
  const fragments = new Map();
  const contracts = [];
  for (const name of appNames) {
    const directory = join(fragmentRoot, name);
    let html;
    let css;
    let contractText;
    try {
      [html, css, contractText] = await Promise.all([
        readFile(join(directory, "fragment.html"), "utf8"),
        readFile(join(directory, "fragment.css"), "utf8"),
        readFile(join(directory, "fragment.json"), "utf8"),
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not read the published ${name} fragment at ${directory}: ${detail}. Run just check to build or fetch every required artifact, then rerun just prerender.`,
      );
    }
    let contract;
    try {
      contract = fragmentContractSchema.parse(JSON.parse(contractText));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `The published ${name} fragment contract is invalid: ${detail}. Rebuild ${name} with the current fragment schema, then rerun just prerender.`,
      );
    }
    if (contract.name !== name)
      throw new Error(
        `Fragment directory ${name} contains contract for ${contract.name}. Publish the contract under its matching app directory, then rerun just prerender.`,
      );
    if (/<\/style|<!--/i.test(css))
      throw new Error(
        `The ${name} fragment CSS cannot be inlined safely. Remove markup tokens from that app's CSS, rebuild it, and rerun just prerender.`,
      );
    const htmlViolations = [
      html.trim().length === 0 && "markup is empty",
      /<(?:html|head|body)\b/i.test(html) &&
        "markup contains a document-level html, head, or body element",
      name === "shell" &&
        !html.includes("data-shell-route") &&
        "shell markup lacks data-shell-route",
    ].filter(Boolean);
    if (htmlViolations.length > 0)
      throw new Error(
        `The ${name} fragment HTML does not match the published page-markup contract: ${htmlViolations.join("; ")}. Rebuild ${name} and rerun just prerender.`,
      );
    fragments.set(name, { html, css });
    contracts.push(contract);
  }
  validateFragmentContracts(contracts);

  const shell = fragments.get("shell");
  let builtDocument;
  try {
    builtDocument = await readFile(
      join(fragmentRoot, "shell", "index.html"),
      "utf8",
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the published shell document: ${detail}. Rebuild or fetch the shell artifact, then rerun just prerender.`,
    );
  }
  const template = builtDocument
    .replace(inlineRemoteCssPattern, "")
    .replace(/<link rel="canonical" href="[^"]*">/g, "")
    .replace(
      /<div id="root"[^>]*>[\s\S]*<\/body>/,
      '<div id="root"></div></body>',
    );
  const requiredDocumentAnchors = [
    ["root placeholder", /<div id="root"><\/div>/],
    ["title", /<title>.*?<\/title>/],
    ["description metadata", /<meta name="description" content="[^"]*">/],
    ["deferred script", /<script defer/],
  ];
  const missingDocumentAnchor = requiredDocumentAnchors.find(
    ([, anchor]) => !anchor.test(template),
  );
  if (!shell || missingDocumentAnchor)
    throw new Error(
      `The published shell artifact lacks its fragment or ${missingDocumentAnchor?.[0] ?? "document metadata"}. Rebuild the shell and rerun just prerender.`,
    );
  const shellDom = new JSDOM(`<body>${shell.html}</body>`);
  const routeTemplates = new Map(
    [
      ...shellDom.window.document.querySelectorAll(
        "template[data-shell-route]",
      ),
    ].map((element) => [
      element.getAttribute("data-shell-route"),
      {
        html: element.innerHTML,
        heading: validatedTextMetadata(
          decodeShellMetadata(element, "data-route-heading", "route heading"),
          "route heading",
        ),
        description: validatedTextMetadata(
          decodeShellMetadata(
            element,
            "data-route-description",
            "route description",
          ),
          "route description",
        ),
        hydration: decodeShellMetadata(
          element,
          "data-router-hydration",
          "router hydration",
        ),
      },
    ]),
  );
  const deferredScriptAnchor = "<script defer";
  for (const [routePath, names] of Object.entries(routeFragments)) {
    const shellRoute = routeTemplates.get(routePath);
    if (!shellRoute)
      throw new Error(
        `The shell fragment has no route template for ${routePath}. Rebuild the shell fragment after aligning its route manifest, then rerun just prerender.`,
      );
    const hydration = validatedHydrationMetadata(
      shellRoute.hydration,
      routePath,
    );
    let markup = shellRoute.html;
    let home = fragments.get("home")?.html;
    if (routePath === "/") {
      if (!home)
        throw new Error(
          "The home fragment is missing. Build or fetch the Home artifact, then rerun just prerender.",
        );
      for (const name of homePanes)
        home = replaceSlot(home, name, fragments.get(name)?.html ?? "");
      markup = replaceSlot(markup, "home", home);
    } else {
      markup = replaceSlot(
        markup,
        names[0],
        fragments.get(names[0])?.html ?? "",
      );
    }
    const styles = new Map();
    for (const name of names) {
      const css = fragments.get(name)?.css ?? "";
      const existing = styles.get(css);
      if (existing) existing.push(name);
      else styles.set(css, [name]);
    }
    const inlineCss = [...styles]
      .map(
        ([css, cssNames]) =>
          `<style data-prerender-remote-css="${cssNames.join(" ")}">${css}</style>`,
      )
      .join("");
    const title =
      routePath === "/"
        ? "Nick DeRobertis"
        : `${shellRoute.heading} | Nick DeRobertis`;
    const document = template
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${shellRoute.description}"><link rel="canonical" href="https://nickderobertis.github.io${pagesBase}${routePath}">`,
      )
      .replace(
        '<div id="root"></div>',
        `<div id="root" ${routeContracts.prerenderRouteAttribute}="${routePath}">${finalizeReactPrerender(markup)}</div>${hydration}`,
      )
      .replace(deferredScriptAnchor, `${inlineCss}${deferredScriptAnchor}`);
    const directory =
      routePath === "/" ? output : join(output, routePath.slice(1));
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "index.html"), document);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not write the composed ${routePath} route: ${detail}. Make COMPOSE_OUTPUT writable and rerun just prerender.`,
      );
    }
  }

  try {
    await writeFile(
      join(output, "404.html"),
      template.replace(
        '<div id="root"></div>',
        '<div id="root"><main class="main"><h1>Loading requested page</h1><p>JavaScript will restore this project-path route.</p></main></div>',
      ),
    );
    await rm(join(output, "cv-data"), { recursive: true, force: true });
    await cp("libs/data-access-core/vendor/codegen", join(output, "cv-data"), {
      recursive: true,
    });
    await rm(join(output, "remotes"), { recursive: true, force: true });
    for (const name of Object.keys(validatedRemoteManifest)) {
      const source = join(fragmentRoot, name);
      await stat(source);
      const destination = join(output, "remotes", name);
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true });
      const remoteDocument = await readFile(
        join(destination, "index.html"),
        "utf8",
      );
      if (!remoteDocument.includes('<div id="root"></div>'))
        throw new Error(
          `The published ${name} remote document lacks its root placeholder. Rebuild ${name} and rerun just prerender.`,
        );
      await writeFile(
        join(destination, "index.html"),
        remoteDocument.replace(
          '<div id="root"></div>',
          `<div id="root" data-prerendered-remote="${name}">${fragments.get(name)?.html ?? ""}</div>`,
        ),
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not stage the composed fallback, CV data, or remote artifacts: ${detail}. Verify published inputs and COMPOSE_OUTPUT permissions, then rerun just prerender.`,
    );
  }
}
// llmlint: ignore-end[changed_behavior_has_e2e]

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await compose({
    fragmentRoot: requiredPath(
      process.env.FRAGMENT_ROOT,
      "dist/apps",
      "FRAGMENT_ROOT",
    ),
    output: requiredPath(
      process.env.COMPOSE_OUTPUT,
      "dist/apps/shell",
      "COMPOSE_OUTPUT",
    ),
  });
}
