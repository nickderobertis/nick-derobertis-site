import "./software.css";

export default function SoftwareSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-software"
      role="status"
      aria-label="Loading software"
    >
      <div className="skeleton-banner" />
      <div className="skeleton-stats" />
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((item) => (
          <i key={item} />
        ))}
      </div>
    </section>
  );
}
