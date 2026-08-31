// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./story.css";

export default function HomeStorySkeleton() {
  return (
    <Skeleton className="skeleton-story skeleton-split" label="Loading story">
      <div className="skeleton-portrait" />
      <div className="skeleton-copy">
        <b />
        <i />
        <i />
        <i />
      </div>
    </Skeleton>
  );
}
