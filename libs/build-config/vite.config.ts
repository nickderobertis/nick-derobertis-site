import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "build-config",
  dir: "libs/build-config",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  // Where this run resolves `@site-fragment/*` (see
  // src/shell-fragment-modules.d.ts). They travel through the harness's alias
  // channel because they are the same kind of specifier a remote is: one no
  // manifest publishes, pointed at the source behind it.
  remotes: {
    "@site-fragment/router":
      "libs/build-config/src/shell-fragment-router.fixture.tsx",
    "@site-fragment/routes":
      "libs/build-config/src/shell-fragment-routes.fixture.ts",
  },
  coverageInclude: ["libs/build-config/src/**/*.{ts,tsx}"],
  coverageExclude: [
    "libs/build-config/src/index.ts",
    // rspack entry points, not modules this library imports: every app build
    // drives both, and every route journey drives what they render. The shell
    // entry's SSR lifecycle is the exception, driven here through the aliases
    // above.
    "libs/build-config/src/remote-fragment-entry.tsx",
    "libs/build-config/src/shell-fragment-entry.tsx",
  ],
});
