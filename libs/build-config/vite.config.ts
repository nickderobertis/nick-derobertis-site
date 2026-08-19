import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "build-config",
  dir: "libs/build-config",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/build-config/src/**/*.{ts,tsx}"],
  coverageExclude: [
    "libs/build-config/src/index.ts",
    // rspack entry points, not modules this library imports: each is compiled
    // in its own build with `@site-fragment/*` aliased to the app it
    // prerenders, so nothing outside that compilation can resolve them. Every
    // app build drives both, and every route journey drives what they render.
    "libs/build-config/src/remote-fragment-entry.tsx",
    "libs/build-config/src/shell-fragment-entry.tsx",
  ],
});
