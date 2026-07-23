import "./research.css";

export default function ResearchSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-research"
      role="status"
      aria-label="Loading research"
    >
      <div className="skeleton-heading" />
      <div className="skeleton-list">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </section>
  );
}
