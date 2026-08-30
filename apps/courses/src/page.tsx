import type { Course } from "@site/data-access-core";
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
    <section className="courses-page">
      <header className="courses-banner">
        <p className="eyebrow">Teaching</p>
        <h1>Courses</h1>
        <p>
          I’ve taught hundreds of students at multiple universities. Browse my
          courses, topics, and teaching resources below.
        </p>
      </header>
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
    </section>
  );
}
