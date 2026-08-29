import { createRequire } from "node:module";
import { afterEach, describe, expect, test } from "vitest";
import { PublishedFragmentPlugin } from "./published-fragment";
import {
  alignJsxRuntimeWithSiblings,
  DevelopmentServerPlugin,
  isDevelopmentServer,
  productionJsxRuntime,
  servedInDevelopment,
  withoutContainerEntry,
} from "./rspack-dev";

const pagesBase = "/nick-derobertis-site/";

/**
 * A build configuration in the shape both callers hand this module: the shell's
 * literal and what `remoteConfig` returns. Only the parts the development
 * overrides replace are here, and the fragment publisher, which they replace.
 */
function buildConfiguration() {
  return {
    entry: "./apps/awards/src/main.tsx",
    output: { publicPath: `${pagesBase}remotes/awards/`, clean: true },
    plugins: [
      { name: "app" },
      new PublishedFragmentPlugin("awards"),
      { name: "federation" },
    ],
  };
}

function servedFromSource<Result>(build: () => Result): Result {
  const restored = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return build();
  } finally {
    if (restored === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = restored;
  }
}

const scriptTag = (src: string) => ({ tagName: "script", attributes: { src } });

afterEach(() => {
  expect(isDevelopmentServer()).toBe(false);
});

describe("what a build outside a development server takes", () => {
  test("nothing: the configuration it was given is the configuration it gets", () => {
    const configuration = buildConfiguration();

    expect(
      servedInDevelopment(configuration, { publicPath: "", siteBase: "" }),
    ).toBe(configuration);
  });

  test("keeps the fragment publisher, the hashed output, and the cleaned directory", () => {
    const served = servedInDevelopment(buildConfiguration(), {
      publicPath: `${pagesBase}remotes/awards/`,
      siteBase: pagesBase,
    });

    expect(served.output).toEqual({
      publicPath: `${pagesBase}remotes/awards/`,
      clean: true,
    });
    expect(served.plugins[1]).toBeInstanceOf(PublishedFragmentPlugin);
    expect(served).not.toHaveProperty("devServer");
  });
});

describe("what a pane served from source takes", () => {
  const servedPane = () =>
    servedFromSource(() =>
      servedInDevelopment(buildConfiguration(), {
        publicPath: `${pagesBase}remotes/awards/`,
        siteBase: pagesBase,
      }),
    );

  test("replaces the fragment publisher with the development server's own plugin", () => {
    const { plugins } = servedPane();

    // In place, so the federation container stays the last plugin declared —
    // and so the second production compilation the publisher runs on every
    // keystroke, over the very artifact this server is reading, is gone.
    expect(plugins[1]).toBeInstanceOf(DevelopmentServerPlugin);
    expect(
      plugins.some((plugin) => plugin instanceof PublishedFragmentPlugin),
    ).toBe(false);
    expect(plugins.at(-1)).toEqual({ name: "federation" });
  });

  test("stops cleaning and hashing the output an update has to be fetched from", () => {
    const { output } = servedPane();

    expect(output).toMatchObject({
      publicPath: `${pagesBase}remotes/awards/`,
      clean: false,
      filename: "[name].js",
      cssFilename: "[name].css",
    });
  });

  test("renders against the composed host's production JSX runtime", () => {
    expect(servedPane().resolve?.alias).toEqual(productionJsxRuntime());
  });

  test("serves every other app out of the whole composed artifact", () => {
    expect(servedPane().devServer).toMatchObject({
      hot: true,
      devMiddleware: { publicPath: `${pagesBase}remotes/awards/` },
      static: [{ directory: "dist/apps/shell", publicPath: pagesBase }],
    });
  });
});

describe("what the host served from source takes", () => {
  const servedHost = () =>
    servedFromSource(() =>
      servedInDevelopment(buildConfiguration(), {
        publicPath: pagesBase,
        siteBase: pagesBase,
      }),
    );

  test("keeps React's development build, and so its fast refresh", () => {
    expect(servedHost().resolve?.alias).toEqual({});
  });

  test("takes only the parts of the artifact it consumes rather than produces", () => {
    // Its own route documents are prerendered against a production bundle, so
    // serving them would answer /bio with the built shell while / answered with
    // the one under development. Every route falls back to the document rspack
    // is building instead.
    expect(servedHost().devServer).toMatchObject({
      devMiddleware: { publicPath: pagesBase },
      static: [
        {
          directory: "dist/apps/shell/remotes",
          publicPath: `${pagesBase}remotes/`,
        },
        {
          directory: "dist/apps/shell/cv-data",
          publicPath: `${pagesBase}cv-data/`,
        },
      ],
      historyApiFallback: { index: `${pagesBase}index.html` },
    });
  });
});

describe("the development document", () => {
  test("drops the app's own container entry and keeps everything else", () => {
    const groups = {
      headTags: [
        scriptTag(`${pagesBase}main.js`),
        scriptTag(`${pagesBase}remoteEntry.js`),
        { tagName: "link", attributes: { href: `${pagesBase}main.css` } },
      ],
      bodyTags: [scriptTag(`${pagesBase}remotes/awards/remoteEntry.js`)],
      publicPath: pagesBase,
    };

    expect(withoutContainerEntry(groups)).toEqual({
      headTags: [
        scriptTag(`${pagesBase}main.js`),
        { tagName: "link", attributes: { href: `${pagesBase}main.css` } },
      ],
      bodyTags: [],
      publicPath: pagesBase,
    });
  });

  test("keeps a script whose name merely ends in the container's", () => {
    // Two runtimes in one document is what this drops, and only the app's own
    // container is one; a bundle named after it is a chunk like any other.
    const groups = {
      headTags: [scriptTag(`${pagesBase}vendor-remoteEntry.js`)],
      bodyTags: [],
    };

    expect(withoutContainerEntry(groups)).toEqual(groups);
  });
});

describe("the JSX runtime a pane compiles against", () => {
  test("turns off the development transform and leaves fast refresh alone", () => {
    const rules = [
      { test: /\.css$/ },
      null,
      {
        loader: "builtin:swc-loader",
        options: {
          jsc: { transform: { react: { development: true, refresh: true } } },
        },
      },
    ];

    alignJsxRuntimeWithSiblings(rules);

    expect(rules[2]).toMatchObject({
      options: {
        jsc: { transform: { react: { development: false, refresh: true } } },
      },
    });
  });

  test("resolves React's production build through the manifest React publishes", () => {
    const resolved = productionJsxRuntime();
    const reactManifest = createRequire(import.meta.url).resolve(
      "react/package.json",
    );

    expect(resolved["react/jsx-runtime"]).toBe(
      reactManifest.replace(
        /package\.json$/,
        "cjs/react-jsx-runtime.production.js",
      ),
    );
    expect(resolved["react/jsx-dev-runtime"]).toBe(
      reactManifest.replace(
        /package\.json$/,
        "cjs/react-jsx-dev-runtime.production.js",
      ),
    );
  });
});
