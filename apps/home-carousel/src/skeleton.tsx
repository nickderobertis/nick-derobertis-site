export default function HomeCarouselSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-carousel"
      role="status"
      aria-label="Loading featured work"
    >
      <div className="skeleton-hero" />
      <div className="skeleton-dots" />
    </section>
  );
}
