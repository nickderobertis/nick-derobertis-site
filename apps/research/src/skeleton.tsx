// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./research.css";

export default function ResearchSkeleton() {
  return (
    <Skeleton className="skeleton-research" label="Loading research">
      <div className="skeleton-heading" />
      <div className="skeleton-list">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </Skeleton>
  );
}
