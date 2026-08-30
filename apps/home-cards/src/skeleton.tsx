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
