import "./timeline.css";

export default function TimelineSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-timeline"
      role="status"
      aria-label="Loading timeline"
    >
      <div className="skeleton-heading" />
      <div className="skeleton-chart">
        {[1, 2, 3, 4].map((item) => (
          <i key={item} />
        ))}
      </div>
    </section>
  );
}
