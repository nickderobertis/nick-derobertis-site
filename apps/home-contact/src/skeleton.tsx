// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./contact.css";

export default function HomeContactSkeleton() {
  return (
    <Skeleton
      className="skeleton-contact skeleton-split"
      label="Loading contact options"
    >
      <div className="skeleton-copy">
        <b />
        <i />
        <i />
      </div>
      <div className="skeleton-links">
        <i />
        <i />
        <i />
      </div>
    </Skeleton>
  );
}
