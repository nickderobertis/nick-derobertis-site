import { Skeleton } from "@site/design-system";
import "./timeline.css";

export default function TimelineSkeleton() {
  return (
    <Skeleton className="skeleton-timeline" label="Loading timeline">
      <div className="skeleton-heading" />
      <div className="skeleton-chart">
        {[1, 2, 3, 4].map((item) => (
          <i key={item} />
        ))}
      </div>
    </Skeleton>
  );
}
