// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import type { ResearchViewState } from "./use-research-page";

// Non-eager shares require an async import boundary before scope initialization.
// llmlint: ignore[changed_behavior_has_e2e] This Research entry defers shared design-system and route-state resolution behind federation initialization. apps/shell/e2e/shared-scope.spec.ts covers its composed and standalone startup boundary, and apps/shell/e2e/site.spec.ts covers the JavaScript-disabled standalone pane journey for all Home panes; research empty, loading, and data-error states remain the same.
const [{ default: Skeleton }] = await Promise.all([
  import("./skeleton"),
  import("@site/design-system"),
]);
const { parseRouteView, routeViewQueryKeys } = await import(
  "@site/route-state"
);

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
// The standalone boundary has no router, so this entry is where the view
// override is read; the shell's route validates the same parameter through
// validateSearch and hands the result to the same prop. The default view stays
// undefined so the page's own chunk — not this entry — pulls the CV data in.
const view = parseRouteView(
  new URLSearchParams(window.location.search).get(routeViewQueryKeys.research),
);
const initialState: ResearchViewState | undefined =
  view === "loading" || view === "error"
    ? { name: view }
    : view === "empty"
      ? { name: "ready", value: { projects: [] } }
      : undefined;
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page initialState={initialState} />
  </Suspense>,
);
