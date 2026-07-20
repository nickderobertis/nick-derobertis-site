import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";

const base = "/nick-derobertis-site/";
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
      },
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
};
