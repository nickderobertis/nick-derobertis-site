// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./cards.css";

export default function HomeCardsSkeleton() {
  return (
    <Skeleton className="skeleton-cards" label="Loading areas of work">
      <div className="skeleton-grid">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </Skeleton>
  );
}
