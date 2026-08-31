import { useEffect, useState } from "react";

function requestedShowAll() {
  return (
    new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    ).get("awards-view") === "all"
  );
}

export function useAwardsView(initialShowAll?: boolean) {
  const [showAll, setShowAll] = useState(initialShowAll ?? requestedShowAll());
  useEffect(() => {
    if (initialShowAll !== undefined) setShowAll(requestedShowAll());
  }, [initialShowAll]);
  return showAll;
}
