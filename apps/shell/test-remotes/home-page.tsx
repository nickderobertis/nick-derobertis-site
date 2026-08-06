let preloaded = 0;

/** Reports how many times the shell warmed Home's panes. */
export function preloadCount() {
  return preloaded;
}

export function preload(): Promise<void> {
  preloaded += 1;
  return Promise.resolve();
}

export default function HomePage() {
  return (
    <section aria-label="Home remote">
      <h1>Finance researcher</h1>
    </section>
  );
}
