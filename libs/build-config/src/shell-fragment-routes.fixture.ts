// What `@site-fragment/routes` resolves to under Vitest, and the one source
// the fixture router builds from: a path, page and domain reach it only from
// here. These routes are the fixture's own rather than a copy of the shell's
// table — the shell's real table reaches the entry through the publish build.
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
