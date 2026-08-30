import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Skeleton from "./skeleton";

// A share cannot be reached from an entry's own chunk: Module Federation
// resolves an initial consume synchronously, before this container has a share
// scope to resolve it in, and refuses. Importing it dynamically is the boundary
// that puts the consume in a chunk the runtime can await instead, which is what
// lets the modules below be singletons one page evaluates once rather than once
// per container.
//
// The theme is started here and awaited at the end of this module rather than
// before the render below, because it is a stylesheet: this document already
// links the rules its skeleton is drawn with, so holding the first paint back
// until the share scope resolved the theme would delay that skeleton for
// nothing. What this entry reads to render with is awaited before the root.
const theme = import("@site/design-system");
const { parseRouteView, routeViewQueryKeys } = await import(
  "@site/route-state"
);

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
// The standalone boundary has no router, so this entry is where the view
// override is read; the shell's route validates the same parameter through
// validateSearch and hands the result to the same prop.
// llmlint: ignore[changed_behavior_has_e2e] courses.spec.ts already drives this entry's happy, empty, loading, and error states through the standalone remotes/ URL with ?courses-view=, alongside the host-composed path.
const initialView = parseRouteView(
  new URLSearchParams(window.location.search).get(routeViewQueryKeys.courses),
);
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page initialView={initialView} />
  </Suspense>,
);
await theme;
