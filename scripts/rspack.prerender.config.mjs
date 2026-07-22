import { resolve } from "node:path";
import { rspack } from "@rspack/core";

export default {
  mode: "production",
  target: "node",
  entry: resolve("scripts/render-entry.tsx"),
  output: {
    path: resolve("dist/prerender-renderer"),
    filename: "render.cjs",
    library: { type: "commonjs2" },
    clean: true,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
    tsConfig: resolve("tsconfig.base.json"),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "builtin:swc-loader",
            options: {
              jsc: {
                parser: { syntax: "typescript", tsx: true },
                transform: { react: { runtime: "automatic" } },
              },
            },
          },
        ],
        type: "javascript/auto",
      },
      { test: /\.css$/, type: "asset/source" },
    ],
  },
  plugins: [
    new rspack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
  ],
  optimization: { minimize: false },
};
