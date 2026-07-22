export default function HomeSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-home"
      role="status"
      aria-label="Loading home"
    >
      <div className="skeleton-hero" />
      <div className="skeleton-grid">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </section>
  );
}
