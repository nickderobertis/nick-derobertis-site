import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";

const base = "/nick-derobertis-site/";
const remotes = Object.fromEntries(
  routes
    .filter((route) => "remote" in route)
    .map((route) => [
      route.remote,
      `${route.remote}@${base}remotes/${route.remote}/remoteEntry.js`,
    ]),
);
export default {
  entry: "./apps/shell/src/main.tsx",
  output: { publicPath: base, uniqueName: "shell", clean: true },
  plugins: [
    new NxAppRspackPlugin({
      tsConfig: "apps/shell/tsconfig.app.json",
      main: "apps/shell/src/main.tsx",
      index: "apps/shell/src/index.html",
      baseHref: base,
      assets: [],
      outputHashing: "all",
      optimization: true,
    }),
    new NxReactRspackPlugin(),
    new ModuleFederationPlugin({
      name: "shell",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/app.tsx" },
      remotes: {
        bio: "bio@/nick-derobertis-site/remotes/bio/remoteEntry.js",
        research:
          "research@/nick-derobertis-site/remotes/research/remoteEntry.js",
        software:
          "software@/nick-derobertis-site/remotes/software/remoteEntry.js",
        courses: "courses@/nick-derobertis-site/remotes/courses/remoteEntry.js",
        timeline:
          "timeline@/nick-derobertis-site/remotes/timeline/remoteEntry.js",
        skills: "skills@/nick-derobertis-site/remotes/skills/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
};
