// `@site-fragment/*` is not a package: it is the pair of specifiers the shell
// fragment entry reaches its app through, resolved by whichever compilation
// owns the entry. The publish build points them at the shell's own router and
// routes; libs/build-config/vite.config.ts points them at the fixtures beside
// this file, so shell-fragment-entry.spec.tsx can drive the real entry. These
// declarations give this project's typecheck the same resolution its test run
// uses. They type the entry against the fixtures rather than against the
// shell — what proves those two agree is the composed artifact, which
// tooling-artifact and the shell's own journeys drive.
declare module "@site-fragment/router" {
  export const createSiteRouter: typeof import("./shell-fragment-router.fixture").createSiteRouter;
}

declare module "@site-fragment/routes" {
  export const routes: typeof import("./shell-fragment-routes.fixture").routes;
}
