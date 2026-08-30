import { Skeleton } from "@site/design-system";
import "./awards.css";

export default function AwardsSkeleton() {
  return (
    <Skeleton className="skeleton-awards" label="Loading awards">
      <div className="skeleton-grid">
        {[1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </Skeleton>
  );
}
