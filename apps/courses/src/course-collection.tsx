import type { Course } from "@site/data-access-core";
import { CoursePane } from "./course-pane";

export function CourseCollection({ courses }: { courses: Course[] }) {
  return (
    <section className="course-list" aria-label="Course list">
      {courses.map((course, index) => (
        <CoursePane course={course} index={index} key={course.id} />
      ))}
    </section>
  );
}
