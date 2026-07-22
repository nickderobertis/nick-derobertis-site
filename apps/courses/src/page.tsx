import type { Course, Resource } from "@site/data-access-core";
import { buildCourseDetails } from "@site/data-access-courses";
import "@site/design-system";
import type { CoursesPageProps } from "@site/route-state";
import { useCoursesPage } from "./use-courses-page";

function ResourceTree({ resources }: { resources: Resource[] }) {
  return (
    <ul className="course-resource-list">
      {resources.map((resource) => (
        <li
          key={`${resource.name}-${resource.author ?? ""}-${resource.url ?? ""}`}
        >
          {resource.url ? (
            <a href={resource.url}>{resource.name}</a>
          ) : (
            <strong>{resource.name}</strong>
          )}
          {resource.author ? <span> by {resource.author}</span> : null}
          {resource.description ? <p>{resource.description}</p> : null}
          {resource.children?.length ? (
            <ResourceTree resources={resource.children} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CourseDetails({ course }: { course: Course }) {
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

function CoursePane({ course, index }: { course: Course; index: number }) {
  const detailsId = `course-${course.id}-details`;
  const { hasDetails } = buildCourseDetails(course);
  return (
    <article className={`course-card ${index % 2 ? "course-card-dark" : ""}`}>
      <div className="course-summary">
        <div>
          <p className="course-code">{course.id.replace("-", " ")}</p>
          <h2>{course.title}</h2>
          {course.description ? <p>{course.description}</p> : null}
          {course.periods_taught?.length ? (
            <ul className="course-periods" aria-label="Periods taught">
              {course.periods_taught.map((period) => (
                <li key={period}>{period}</li>
              ))}
            </ul>
          ) : null}
          <dl className="course-facts">
            {course.evaluation_score != null ? (
              <div>
                <dt>Evaluation score</dt>
                <dd>
                  {course.evaluation_score}
                  <span> / {course.evaluation_max_score ?? 5}</span>
                </dd>
              </div>
            ) : null}
            {course.university_name ? (
              <div>
                <dt>University</dt>
                <dd>{course.university_name}</dd>
                {course.university_location ? (
                  <dd className="course-location">
                    {course.university_location}
                  </dd>
                ) : null}
              </div>
            ) : null}
          </dl>
          {course.website_url ? (
            <a className="course-action" href={course.website_url}>
              Course website
            </a>
          ) : null}
        </div>
        {course.topics?.length ? (
          <section
            className="course-topics"
            aria-label={`${course.title} topics`}
          >
            <h3>Topics covered</h3>
            <ul>
              {course.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {hasDetails ? (
        <details className="course-more" id={detailsId}>
          <summary>Explore {course.title} details</summary>
          <CourseDetails course={course} />
        </details>
      ) : null}
    </article>
  );
}

function CourseCollection({ courses }: { courses: Course[] }) {
  return (
    <section className="course-list" aria-label="Course list">
      {courses.map((course, index) => (
        <CoursePane course={course} index={index} key={course.id} />
      ))}
    </section>
  );
}

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
        <div className="courses-state" role="status">
          Loading courses…
        </div>
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
