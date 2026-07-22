export default function HomeContactSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-contact"
      role="status"
      aria-label="Loading contact options"
    >
      <div className="skeleton-copy">
        <b />
        <i />
        <i />
      </div>
      <div className="skeleton-links">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}
