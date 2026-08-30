import { Skeleton } from "@site/design-system";
import "./courses.css";

export default function CoursesSkeleton() {
  return (
    <Skeleton className="skeleton-courses" label="Loading courses">
      <div className="skeleton-banner" />
      <div className="skeleton-course" />
      <div className="skeleton-course" />
    </Skeleton>
  );
}
