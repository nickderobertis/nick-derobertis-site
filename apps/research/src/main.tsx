import "@site/design-system";
import { parseRouteView } from "@site/route-state";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Skeleton from "./skeleton";
import type { ResearchViewState } from "./use-research-page";

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
// The standalone boundary has no router, so this entry is where the view
// override is read; the shell's route validates the same parameter through
// validateSearch and hands the result to the same prop. The default view stays
// undefined so the page's own chunk — not this entry — pulls the CV data in.
const view = parseRouteView(
  new URLSearchParams(window.location.search).get("research-scenario"),
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
