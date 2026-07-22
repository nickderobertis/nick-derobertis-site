export default function AwardsSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-awards"
      role="status"
      aria-label="Loading awards"
    >
      <div className="skeleton-grid">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </section>
  );
}
