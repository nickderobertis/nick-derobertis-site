// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./home.css";

export default function HomeSkeleton() {
  return (
    <Skeleton className="skeleton-home" label="Loading home">
      <div className="skeleton-hero" />
      <div className="skeleton-grid">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </Skeleton>
  );
}
