// eslint-disable-next-line @nx/enforce-module-boundaries -- This stand-in remote mirrors the validated payload the shell owns at its route boundary, for the shell's own tests.
import type { Courses } from "@site/data-access-core";
import type { CoursesPageProps } from "@site/route-state";

export default function CoursesPage({
  courses,
  initialView,
}: CoursesPageProps<Courses>) {
  return (
    <article aria-label="Courses remote">
      <h1>Courses</h1>
      <p>view: {initialView ?? "default"}</p>
      <p>courses: {courses ? courses.length : "none"}</p>
    </article>
  );
}
