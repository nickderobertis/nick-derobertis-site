import "@site/design-system";
import { parseRouteView } from "@site/route-state";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Skeleton from "./skeleton";

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
// The standalone boundary has no router, so this entry is where the view
// override is read; the shell's route validates the same parameter through
// validateSearch and hands the result to the same prop.
const initialView = parseRouteView(
  new URLSearchParams(window.location.search).get("software-view"),
);
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page initialView={initialView} />
  </Suspense>,
);
