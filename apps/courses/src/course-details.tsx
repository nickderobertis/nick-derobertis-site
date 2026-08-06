import type { Course } from "@site/data-access-core";
import { buildCourseDetails } from "@site/data-access-courses";
import { ResourceTree } from "./resource-tree";

export function CourseDetails({ course }: { course: Course }) {
  const { gradingCategories, gradeScale } = buildCourseDetails(course);
  return (
    <div className="course-details">
      {course.long_description ? (
        <section className="course-pane course-overview">
          <h3>About this course</h3>
          <p>{course.long_description}</p>
          {course.current_period || course.current_time ? (
            <p>
              <strong>Current offering:</strong>{" "}
              {[course.current_period, course.current_time]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {course.daily_prep ? (
            <p>
              <strong>Preparation:</strong> {course.daily_prep}
            </p>
          ) : null}
        </section>
      ) : null}

      {course.textbook ? (
        <section className="course-pane">
          <h3>Textbook</h3>
          <p>
            <strong>{course.textbook.title}</strong> by {course.textbook.author}
          </p>
          {course.textbook.publisher_details ? (
            <p>{course.textbook.publisher_details}</p>
          ) : null}
          <p>{course.textbook.required ? "Required" : "Recommended"}</p>
          {course.textbook.description ? (
            <p>{course.textbook.description}</p>
          ) : null}
        </section>
      ) : null}

      {course.prerequisites ? (
        <section className="course-pane">
          <h3>Prerequisites</h3>
          {course.prerequisites.description ? (
            <p>{course.prerequisites.description}</p>
          ) : null}
          {course.prerequisites.required_course_ids?.length ? (
            <p>
              <strong>Required:</strong>{" "}
              {course.prerequisites.required_course_ids.join(", ")}
            </p>
          ) : null}
          {course.prerequisites.recommended_course_ids?.length ? (
            <p>
              <strong>Recommended:</strong>{" "}
              {course.prerequisites.recommended_course_ids.join(", ")}
            </p>
          ) : null}
          {course.prerequisites.technical_skills?.length ? (
            <>
              <h4>Technical skills</h4>
              <ul>
                {course.prerequisites.technical_skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </>
          ) : null}
          {course.prerequisites.technical_skills_description ? (
            <p>{course.prerequisites.technical_skills_description}</p>
          ) : null}
        </section>
      ) : null}

      {gradingCategories.length ? (
        <section className="course-pane">
          <h3>Grading</h3>
          <dl className="course-grading-categories">
            {gradingCategories.map(([category, weight]) => (
              <div key={category}>
                <dt>{category}</dt>
                <dd>{Math.round(weight * 100)}%</dd>
              </div>
            ))}
          </dl>
          {gradeScale.length ? (
            <details>
              <summary>View grade scale</summary>
              <dl className="course-grade-scale">
                {gradeScale.map(([grade, range]) => (
                  <div key={grade}>
                    <dt>{grade}</dt>
                    <dd>
                      {range.minimum}–{range.maximum}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </section>
      ) : null}

      {course.resources?.length ? (
        <section className="course-pane course-resources">
          <h3>Resources</h3>
          <ResourceTree resources={course.resources} />
        </section>
      ) : null}
    </div>
  );
}
