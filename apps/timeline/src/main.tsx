import "@site/design-system";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Skeleton from "./skeleton";

const TimelinePage = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <TimelinePage />
  </Suspense>,
);
