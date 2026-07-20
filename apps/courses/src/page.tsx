import { cvDataClient } from "@site/data-access";
export default function CoursesPage() {
  return (
    <section className="hero">
      <p className="eyebrow">Nick DeRobertis</p>
      <h1>Courses</h1>
      <p>Course materials and teaching resources.</p>
      <output className="placeholder">
        Courses remote loaded · {cvDataClient.domain("courses").length} courses
      </output>
    </section>
  );
}
