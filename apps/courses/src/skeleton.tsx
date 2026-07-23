import "./courses.css";

export default function CoursesSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-courses"
      role="status"
      aria-label="Loading courses"
    >
      <div className="skeleton-banner" />
      <div className="skeleton-course" />
      <div className="skeleton-course" />
    </section>
  );
}
