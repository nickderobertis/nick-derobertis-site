import "./skills.css";

export default function SkillsSkeleton() {
  return (
    <section
      className="remote-skeleton skeleton-skills"
      role="status"
      aria-label="Loading skills"
    >
      <div className="skeleton-heading" />
      <div className="skeleton-circle" />
      <div className="skeleton-controls">
        <i />
        <i />
      </div>
    </section>
  );
}
