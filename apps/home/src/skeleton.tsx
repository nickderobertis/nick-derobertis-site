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
