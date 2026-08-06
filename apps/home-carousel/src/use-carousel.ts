import { useEffect, useState } from "react";

/**
 * Which featured story the carousel is showing. Rotation advances on its own
 * only while the pane has stories to rotate through, so a previewed empty,
 * loading, or error pane never schedules a timer it cannot use. `move` wraps in
 * both directions, so the controls stay usable at either end of the list.
 */
export function useCarousel(length: number, enabled: boolean) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [enabled, length]);
  const move = (offset: number) =>
    setActive((current) => (current + offset + length) % length);
  return { active, move };
}
