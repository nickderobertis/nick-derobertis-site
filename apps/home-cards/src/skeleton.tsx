export default function HomeCardsSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-cards"
      role="status"
      aria-label="Loading areas of work"
    >
      <div className="skeleton-grid">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </section>
  );
}
