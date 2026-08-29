// The route table the shell fragment entry's spec drives it over, and the one
// source the fixture router beside it builds its routes from: a path, a page
// and a domain named here reach the router only from this array, so the two
// halves of the fixture cannot disagree about what the entry renders.
//
// The publish build aliases `@site-fragment/routes` to the shell's own
// `routes.ts`; this file is what that alias points at under Vitest, so the
// entry itself stays the real one while the app it prerenders stays inside
// this library's own tree. These entries are this fixture's own rather than a
// copy of the shell's table — nothing here is asserted to match a shell route,
// and what proves the entry renders the shell's real table is the composed
// artifact, which tooling-artifact and the shell's own journeys drive.
export type FragmentPageName =
  | "home"
  | "bio"
  | "research"
  | "software"
  | "courses";

/** The CV domains the entry hands its router, named as the CV publishes them. */
export type FragmentDomainName = "courses" | "research" | "software_projects";

export interface FragmentRoute {
  path: string;
  heading: string;
  description: string;
  /** The key under the entry's `pages` this route renders. */
  page: FragmentPageName;
  /** The domain this route's loader asks the entry's context for, if any. */
  domain?: FragmentDomainName;
}

export const routes: FragmentRoute[] = [
  {
    path: "/",
    page: "home",
    heading: "Fixture home",
    description: "The fixture root route.",
  },
  {
    path: "/bio",
    page: "bio",
    heading: "Fixture bio",
    description: "A fixture route with no loader.",
  },
  {
    path: "/research",
    page: "research",
    domain: "research",
    heading: "Fixture research",
    description: "A fixture route with a loader.",
  },
  {
    path: "/software",
    page: "software",
    domain: "software_projects",
    heading: "Fixture software",
    description: "A fixture route with a loader.",
  },
  {
    path: "/courses",
    page: "courses",
    domain: "courses",
    heading: "Fixture courses",
    description: "A fixture route with a loader.",
  },
];
