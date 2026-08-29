// `@site-fragment/*` is not a package: it is the pair of specifiers the shell
// fragment entry reaches its app through, resolved by whichever compilation
// owns the entry — the publish build points them at the shell's own router and
// routes, and this project's Vitest run points them at the fixtures beside this
// file. These declarations give the typecheck that same resolution. They type
// the entry against the fixtures rather than the shell; what proves those two
// agree is the composed artifact the shell's journeys drive.
declare module "@site-fragment/router" {
  export const createSiteRouter: typeof import("./shell-fragment-router.fixture").createSiteRouter;
}

declare module "@site-fragment/routes" {
  export const routes: typeof import("./shell-fragment-routes.fixture").routes;
}
