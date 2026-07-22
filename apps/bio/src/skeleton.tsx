export default function BioSkeleton() {
  return (
    <article
      className="remote-skeleton skeleton-bio"
      role="status"
      aria-label="Loading biography"
    >
      <div className="skeleton-cover" />
      <div className="skeleton-copy">
        <b />
        <i />
        <i />
        <i />
        <i />
      </div>
    </article>
  );
}
