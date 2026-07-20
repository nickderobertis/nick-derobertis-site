import { SiteLayout } from "@site/layout";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes, type SiteRoute } from "./routes";

const BioPage = lazy(() => import("bio/Page"));
const ResearchPage = lazy(() => import("research/Page"));
const SoftwarePage = lazy(() => import("software/Page"));
const CoursesPage = lazy(() => import("courses/Page"));
function requireRoute(path: string): SiteRoute {
  const route = routes.find((candidate) => candidate.path === path);
  if (!route) throw new Error(`Route ${path} is required`);
  return route;
}
const homeRoute = requireRoute("/");

function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Nick DeRobertis</p>
      <h1>{homeRoute.heading}</h1>
      <p>{homeRoute.description}</p>
    </section>
  );
}

function RemoteFallback() {
  return <output className="placeholder">Loading page…</output>;
}

export function App() {
  const navigation = routes.map(({ path, label }) => ({ path, label }));
  return (
    <SiteLayout routes={navigation}>
      <Suspense fallback={<RemoteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bio" element={<BioPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/software" element={<SoftwarePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SiteLayout>
  );
}
