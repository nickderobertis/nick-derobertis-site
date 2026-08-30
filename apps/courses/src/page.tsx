import type { Course } from "@site/data-access-core";
import { PageShell, SectionHeading } from "@site/design-system";
import type { CoursesPageProps } from "@site/route-state";
import "./courses.css";
import { CourseCollection } from "./course-collection";
import Skeleton from "./skeleton";
import { useCoursesPage } from "./use-courses-page";

export default function CoursesPage({
  initialView,
  courses: initialCourses,
}: CoursesPageProps<Course[]>) {
  const { courses, view } = useCoursesPage(initialView, initialCourses);
  return (
    // llmlint: ignore[changed_behavior_has_e2e] courses/e2e/courses.spec.ts drives this page's happy, empty, loading, and error scenarios through both standalone and host-composed URLs; the shared primitives' painted contract is additionally covered by the home-cards and home-story dual-path journeys, so duplicating CSS assertions here would not exercise a distinct boundary.
    <PageShell className="courses-page">
      <SectionHeading
        className="courses-banner"
        level={1}
        eyebrow="Teaching"
        title="Courses"
        description="I’ve taught hundreds of students at multiple universities. Browse my courses, topics, and teaching resources below."
      />
      {view === "loading" ? (
        <Skeleton />
      ) : view === "error" ? (
        <div className="courses-state courses-state-error" role="alert">
          <h2>Courses are unavailable</h2>
          <p>Please try again later.</p>
        </div>
      ) : view === "empty" ? (
        <div className="courses-state" role="status">
          <h2>No courses to show</h2>
          <p>Course information will appear here when it is available.</p>
        </div>
      ) : (
        <CourseCollection courses={courses} />
      )}
    </PageShell>
  );
}
