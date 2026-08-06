import "@site/design-system";
import "./bio.css";
import type { BioPageProps } from "@site/route-state";
import { BioState } from "./bio-state";
import { Biography } from "./biography";
import Skeleton from "./skeleton";
import { useBioView } from "./use-bio-view";

export default function BioPage({ initialView }: BioPageProps) {
  // llmlint: ignore-block[changed_behavior_has_e2e] bio.spec.ts drives happy, loading, empty, and error query states through both host-composed and standalone URLs.
  const scenario = useBioView(initialView);
  if (scenario === "loading") return <Skeleton />;
  if (scenario === "empty" || scenario === "error")
    return <BioState state={scenario} />;
  // llmlint: ignore-end[changed_behavior_has_e2e]
  return <Biography />;
}
