// The route table the shell fragment entry's spec compiles it against. The
// publish build aliases `@site-fragment/routes` to the shell's own
// `routes.ts`; this file is what that alias points at under Vitest, so the
// entry itself stays the real one while the app it prerenders stays inside
// this library's own tree. It mirrors the five prerendered shell routes —
// `/story` and the catch-all redirect rather than render, so neither is here.
export interface FragmentRoute {
  path: string;
  heading: string;
  description: string;
}

export const routes: FragmentRoute[] = [
  { path: "/", heading: "Finance researcher", description: "Welcome." },
  { path: "/bio", heading: "Biography", description: "Professor." },
  { path: "/research", heading: "Research", description: "Working papers." },
  { path: "/software", heading: "Open-Source Software", description: "Code." },
  { path: "/courses", heading: "Courses", description: "Teaching." },
];
