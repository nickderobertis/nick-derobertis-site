import { Skeleton } from "@site/design-system";
import "./bio.css";

export default function BioSkeleton() {
  return (
    <Skeleton as="article" className="skeleton-bio" label="Loading biography">
      <div className="skeleton-cover" />
      <div className="skeleton-copy">
        <b />
        <i />
        <i />
        <i />
        <i />
      </div>
    </Skeleton>
  );
}
