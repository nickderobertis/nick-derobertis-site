import { Skeleton } from "@site/design-system";
import "./skills.css";

export default function SkillsSkeleton() {
  return (
    <Skeleton className="skeleton-skills" label="Loading skills">
      <div className="skeleton-heading" />
      <div className="skeleton-circle" />
      <div className="skeleton-controls">
        <i />
        <i />
      </div>
    </Skeleton>
  );
}
