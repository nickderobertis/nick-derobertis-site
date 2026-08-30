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
