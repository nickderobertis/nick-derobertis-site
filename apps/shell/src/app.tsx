import { SiteLayout } from "@site/layout";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes } from "./routes";

const HomePage = lazy(() => import("home/Page"));
const BioPage = lazy(() => import("bio/Page"));
const ResearchPage = lazy(() => import("research/Page"));
const SoftwarePage = lazy(() => import("software/Page"));
const CoursesPage = lazy(() => import("courses/Page"));
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
          {/* llmlint: ignore[changed_behavior_has_e2e] The real-browser legacy story route journey covers this redirect and resulting remote. */}
          <Route path="/story" element={<Navigate to="/bio" replace />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/software" element={<SoftwarePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SiteLayout>
  );
}
