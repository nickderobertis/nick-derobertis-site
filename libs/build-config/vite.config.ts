import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "build-config",
  dir: "libs/build-config",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  // `@site-fragment/*` is not a package: it is how the shell fragment entry
  // reaches the app it prerenders, resolved by whichever compilation owns the
  // entry. The publish build points the pair at the shell's own router and
  // routes; this run points them at the fixtures beside the entry, so
  // shell-fragment-entry.spec.tsx drives the real entry. They travel through
  // the harness's alias channel because that is the one it has, and because
  // they are the same kind of thing a remote specifier is: a specifier no
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
    // rspack entry points, not modules this library imports: each is compiled
    // in its own build with `@site-fragment/*` aliased to the app it
    // prerenders, so nothing outside that compilation can resolve them. Every
    // app build drives both, and every route journey drives what they render.
    // The shell entry's SSR lifecycle is driven directly by
    // shell-fragment-entry.spec.tsx through the aliases above; the rest of both
    // entries stays owned by the builds that compile them.
    "libs/build-config/src/remote-fragment-entry.tsx",
    "libs/build-config/src/shell-fragment-entry.tsx",
  ],
});
