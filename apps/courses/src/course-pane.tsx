import type { Course } from "@site/data-access-core";
import { buildCourseDetails } from "@site/data-access-courses";
import { ActionLink, Card } from "@site/design-system";
import { CourseDetails } from "./course-details";

export function CoursePane({
  course,
  index,
}: {
  course: Course;
  index: number;
}) {
  const detailsId = `course-${course.id}-details`;
  const { hasDetails } = buildCourseDetails(course);
  return (
    <Card className={`course-card ${index % 2 ? "course-card-dark" : ""}`}>
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
            <ActionLink className="course-action" href={course.website_url}>
              Course website
            </ActionLink>
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
                <Card as="li" key={topic}>
                  {topic}
                </Card>
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
    </Card>
  );
}
