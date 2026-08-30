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

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page />
  </Suspense>,
);
await theme;
