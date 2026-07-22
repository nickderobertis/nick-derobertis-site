import "./story.css";

export default function HomeStorySkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-story"
      role="status"
      aria-label="Loading story"
    >
      <div className="skeleton-portrait" />
      <div className="skeleton-copy">
        <b />
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}
