import "@site/design-system";
import { lazy, Suspense } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import Skeleton from "./skeleton";

const pageModule = import("./page");
const TimelinePage = lazy(() => pageModule);

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
const canHydrate = root.hasChildNodes() && !window.location.search;
if (canHydrate) {
  const { default: HydratedPage } = await pageModule;
  hydrateRoot(root, <HydratedPage />);
} else {
  root.replaceChildren();
  createRoot(root).render(
    <Suspense fallback={<Skeleton />}>
      <TimelinePage />
    </Suspense>,
  );
}
