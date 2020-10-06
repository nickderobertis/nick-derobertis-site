export function isTouchDevice(): boolean {
  if ('ontouchstart' in window) {
    return true;
  }

  const prefixes = ['', '-webkit-', '-moz-', '-o-', '-ms-'];
  const queries = prefixes.map((prefix) => `(${prefix}touch-enabled)`);

  return window.matchMedia(queries.join(',')).matches;
}
