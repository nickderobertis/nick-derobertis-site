import type { BioPageProps } from "@site/route-state";

export default function BioPage({ initialView }: BioPageProps) {
  return (
    <article aria-label="Bio remote">
      <h1>Optimizing Life</h1>
      <p>view: {initialView ?? "default"}</p>
    </article>
  );
}
