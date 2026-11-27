import type { Course } from "@site/data-access-core";
import { buildCourseDetails } from "@site/data-access-courses";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { ActionLink, Card, SpikeIcon } from "@site/design-system";

// SPIKE MOCK (throwaway): Topics Covered transcribed from the live /courses page.
const spikeTopics: Record<string, [string, string[]][]> = {
  "FIN-4934": [
    ["Introduction to Financial Modeling", ["Overview", "Basic technical skills and setup – Excel and Python", "Time value of money models", "Basic statistical tools", "Monte Carlo methods"]],
    ["Corporate Valuation", ["Capital budgeting", "Estimating beta", "Estimating market value of debt", "Weighted average cost of capital (WACC)", "Free cash flow (FCF)", "Pro forma financial statements", "Discounted cash flow (DCF) valuation"]],
  ],
  "FIN-4243": [
    ["Debt Analysis", ["Time value of money", "Bond pricing", "Yield to Maturity", "Interest Rates", "Types of debt", "Risk factors for debt", "Term structure of interest rates"]],
    ["Debt Portfolio Management", ["Duration", "Immunization", "Convexity", "Credit risk analysis", "Bond options", "Interest rate swaps", "Credit default swaps"]],
  ],
  "FIRE-311": [["Excel", ["Cell references", "Formulas", "Pivot tables", "Iteration", "Macros", "Regressions"]]],
};
function SpikeUniversityLogo({ name }: { name: string }) {
  const vcu = name.includes("Virginia");
  return (
    <svg className="course-university-logo" viewBox="0 0 64 32" width="64" height="32" role="img" aria-label={`${name} logo`}>
      {vcu ? <circle cx="10" cy="16" r="8" fill="#000" stroke="#f8b00f" strokeWidth="2.5" /> : null}
      <text x={vcu ? 40 : 32} y="25" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize={vcu ? 20 : 26} fill={vcu ? "#f8b00f" : "#0021a5"}>{vcu ? "VCU" : "UF"}</text>
    </svg>
  );
}
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
                <dt>
                  <SpikeIcon name="tasks" size={22} /> Evaluations
                </dt>
                <dd>
                  {course.evaluation_score}
                  <span> / {course.evaluation_max_score ?? 5}</span>
                </dd>
              </div>
            ) : null}
            {course.university_name ? (
              <div>
                <dt>
                  <SpikeUniversityLogo name={course.university_name} />
                </dt>
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
            <h3>Topics Covered</h3>
            <ul className="course-topic-cards">
              {(spikeTopics[course.id] ?? course.topics.map((t) => [t, []] as [string, string[]])).map(([topic, children]) => (
                <Card as="li" className="course-topic-card" key={topic}>
                  <h4>{topic}</h4>
                  <ol type="i">
                    {children.map((child) => (
                      <li key={child}>{child}</li>
                    ))}
                  </ol>
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
