import { SiteLayout } from "@site/layout";
import BioSkeleton from "bio/Skeleton";
import CoursesSkeleton from "courses/Skeleton";
import HomeSkeleton from "home/Skeleton";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ResearchSkeleton from "research/Skeleton";
import SoftwareSkeleton from "software/Skeleton";
import { routes } from "./routes";

// Static federated imports put the lightweight skeleton modules in the shell's
// eager startup graph; only the Page imports below create lazy chunks.
const HomePage = lazy(() => import("home/Page"));
const BioPage = lazy(() => import("bio/Page"));
const ResearchPage = lazy(() => import("research/Page"));
const SoftwarePage = lazy(() => import("software/Page"));
const CoursesPage = lazy(() => import("courses/Page"));

export function App() {
  const navigation = routes.map(({ path, label }) => ({ path, label }));
  return (
    <SiteLayout routes={navigation}>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<HomeSkeleton />}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="/bio"
          element={
            <Suspense fallback={<BioSkeleton />}>
              <BioPage />
            </Suspense>
          }
        />
        {/* llmlint: ignore[changed_behavior_has_e2e] The real-browser legacy story route journey covers this redirect and resulting remote. */}
        <Route path="/story" element={<Navigate to="/bio" replace />} />
        <Route
          path="/research"
          element={
            <Suspense fallback={<ResearchSkeleton />}>
              <ResearchPage />
            </Suspense>
          }
        />
        <Route
          path="/software"
          element={
            <Suspense fallback={<SoftwareSkeleton />}>
              <SoftwarePage />
            </Suspense>
          }
        />
        <Route
          path="/courses"
          element={
            <Suspense fallback={<CoursesSkeleton />}>
              <CoursesPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SiteLayout>
  );
}
