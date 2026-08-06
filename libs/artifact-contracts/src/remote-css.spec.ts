import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  inlineRemoteCssAttribute,
  inlineRemoteCssPattern,
  readRouteRemoteStyles,
  remotesForRoute,
  renderInlineRemoteCss,
  validatePagesBase,
} from "./remote-css.ts";

// Every case builds a real built-remote directory — the hashed stylesheet
// linked from the remote's own index.html — because that layout is the only
// input this module has, and a stand-in for it could agree with a reader that
// no longer matches what an rspack build emits.
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function remoteRoot(remotes: Record<string, { index?: string; css?: string }>) {
  const root = mkdtempSync(join(tmpdir(), "remote-css-"));
  roots.push(root);
  for (const [name, { index, css }] of Object.entries(remotes)) {
    const directory = join(root, name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "index.html"),
      index ??
        '<link rel="stylesheet" href="/base/remotes/x/main.abc123.css"><script src="main.js"></script>',
    );
    if (css !== undefined)
      writeFileSync(join(directory, "main.abc123.css"), css);
  }
  return root;
}

function bioStyles(remotes: Parameters<typeof remoteRoot>[0]) {
  return readRouteRemoteStyles({
    remoteRoot: remoteRoot(remotes),
    pagesBase: "/nick-derobertis-site",
    routePath: "/bio",
  });
}

describe("route remote inventory", () => {
  test("names the remotes whose markup each route document prerenders", () => {
    expect(remotesForRoute("/bio")).toEqual(["bio"]);
    expect(remotesForRoute("/")).toContain("awards");
  });

  test("refuses a route that declares no prerendered page CSS", () => {
    expect(() => remotesForRoute("/newsletter")).toThrow(
      /No prerendered page CSS is declared for route "\/newsletter"/,
    );
  });
});

describe("Pages base validation", () => {
  test("accepts the project base the site is served from", () => {
    expect(validatePagesBase("/nick-derobertis-site")).toBe(
      "/nick-derobertis-site",
    );
  });

  test.each([["/Nick"], ["nick"], ["/nick/deep"], [7], [undefined]])(
    "rejects %p, which cannot be a Pages project base",
    (value) => {
      expect(() => validatePagesBase(value)).toThrow(
        /Pages base path must match/,
      );
    },
  );
});

describe("reading a route's remote page CSS", () => {
  test("absolutizes only the relative url() targets a remote published", async () => {
    const styles = await bioStyles({
      bio: {
        css: [
          "@font-face{src:url(fonts/sans.woff2) url(\"logo.png\") url('q.svg')}",
          ".a{background:url(/already/absolute.png)}",
          ".b{background:url(https://cdn.example/x.png)}",
          ".c{mask:url(#clip)}",
          ".d{background:url()}",
        ].join(""),
      },
    });

    const [style] = styles;
    expect(style?.names).toEqual(["bio"]);
    expect(style?.css).toContain(
      'url("/nick-derobertis-site/remotes/bio/fonts/sans.woff2")',
    );
    expect(style?.css).toContain(
      'url("/nick-derobertis-site/remotes/bio/logo.png")',
    );
    expect(style?.css).toContain(
      'url("/nick-derobertis-site/remotes/bio/q.svg")',
    );
    expect(style?.css).toContain("url(/already/absolute.png)");
    expect(style?.css).toContain("url(https://cdn.example/x.png)");
    expect(style?.css).toContain("url(#clip)");
    expect(style?.css).toContain("url()");
  });

  test("collapses the theme several remotes re-bundle into one style element", async () => {
    const shared = ":root{--navy:#12324a}";
    const styles = await readRouteRemoteStyles({
      remoteRoot: remoteRoot({
        home: { css: shared },
        "home-carousel": { css: shared },
        "home-cards": { css: shared },
        "home-story": { css: ".story{color:red}" },
        "home-contact": { css: shared },
        timeline: { css: shared },
        skills: { css: shared },
        awards: { css: shared },
      }),
      pagesBase: "/nick-derobertis-site",
      routePath: "/",
    });

    expect(styles).toHaveLength(2);
    expect(styles[0]?.names).toEqual([
      "home",
      "home-carousel",
      "home-cards",
      "home-contact",
      "timeline",
      "skills",
      "awards",
    ]);
    expect(styles[1]?.names).toEqual(["home-story"]);
  });

  test("refuses a remote that was never built", async () => {
    await expect(bioStyles({})).rejects.toThrow(
      /Could not read the built bio remote document/,
    );
  });

  test("refuses a built remote whose page stylesheet is missing", async () => {
    await expect(bioStyles({ bio: {} })).rejects.toThrow(
      /Could not read the built bio page CSS/,
    );
  });

  test.each([
    ["links no hashed main stylesheet", '<link rel="stylesheet" href="x.css">'],
    [
      "links more than one",
      '<link rel="stylesheet" href="main.abc123.css"><link rel="stylesheet" href="main.def456.css">',
    ],
    [
      "preloads rather than links its stylesheet",
      '<link rel="preload" href="main.abc123.css">',
    ],
  ])("refuses a document that %s", async (_case, index) => {
    await expect(
      bioStyles({ bio: { index, css: ".a{color:red}" } }),
    ).rejects.toThrow(/must link exactly one hashed main stylesheet/);
  });

  test.each([
    ["closes the style element it would be inlined into", ".a{}</style>"],
    [
      "opens a comment the browser would swallow the document into",
      ".a{}<!-- x",
    ],
  ])("refuses page CSS that %s", async (_case, css) => {
    await expect(bioStyles({ bio: { css } })).rejects.toThrow(
      /contains markup that cannot be inlined safely/,
    );
  });

  test("refuses to read a route's styles against an invalid Pages base", async () => {
    await expect(
      readRouteRemoteStyles({
        remoteRoot: remoteRoot({ bio: { css: ".a{}" } }),
        pagesBase: "/Nick",
        routePath: "/bio",
      }),
    ).rejects.toThrow(/Pages base path must match/);
  });
});

describe("rendering inlined remote CSS", () => {
  test("attributes each style element with the remotes that produced it", () => {
    const rendered = renderInlineRemoteCss([
      { css: ".a{color:red}", names: ["home", "awards"] },
      { css: ".b{color:blue}", names: ["timeline"] },
    ]);

    expect(rendered).toBe(
      `<style ${inlineRemoteCssAttribute}="home awards">.a{color:red}</style>` +
        `<style ${inlineRemoteCssAttribute}="timeline">.b{color:blue}</style>`,
    );
  });

  test("matches exactly the style elements it emitted and nothing else", () => {
    const document = `<style>.untouched{}</style>${renderInlineRemoteCss([
      { css: ".a{}", names: ["bio"] },
    ])}`;

    expect(document.replace(inlineRemoteCssPattern, "")).toBe(
      "<style>.untouched{}</style>",
    );
  });
});
