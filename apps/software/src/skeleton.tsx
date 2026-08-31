// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./software.css";

export default function SoftwareSkeleton() {
  return (
    <Skeleton className="skeleton-software" label="Loading software">
      <div className="skeleton-banner" />
      <div className="skeleton-stats" />
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((item) => (
          <i key={item} />
        ))}
      </div>
    </Skeleton>
  );
}
