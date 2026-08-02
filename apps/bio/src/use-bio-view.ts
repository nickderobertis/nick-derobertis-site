import type { RouteView } from "@site/route-state";
import { useEffect, useState } from "react";

export function useBioView(initialView?: RouteView): RouteView {
  const [view, setView] = useState<RouteView>(initialView ?? "default");
  // `loading` is a preview scenario, not a real fetch state: this pane has no
  // request to await. The timer resolves it back to `default` so a previewed
  // skeleton demonstrates itself and then leaves, rather than sticking for the
  // rest of the session.
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return view;
}
