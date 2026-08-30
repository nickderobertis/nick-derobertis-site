// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Skeleton } from "@site/design-system";
import "./carousel.css";

export default function HomeCarouselSkeleton() {
  return (
    <Skeleton className="skeleton-carousel" label="Loading featured work">
      <div className="skeleton-hero" />
      <div className="skeleton-dots" />
    </Skeleton>
  );
}
