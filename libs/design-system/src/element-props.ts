/**
 * The attributes a primitive hands to the element it renders: the class list the
 * primitive composed, plus every prop the app passed that the primitive does not
 * consume itself, so an app can still set `aria-*`, `data-*` or `id` on it.
 *
 * The split is one loop, and every primitive calls `createElement` rather than
 * spreading into JSX, because rest destructuring and a JSX spread compile at
 * this workspace's build target to roughly 1.5 KB of inlined
 * `Object.getOwnPropertyDescriptors` shims *per component*. These primitives
 * ship inside all twelve remotes' federated `./Page` chunks, so paying that per
 * component per remote would cost the composed home route about 50 KB — more
 * than the design system saves it by collapsing the duplicated CSS.
 */
export function elementProps<Props extends object>(
  props: Props,
  own: readonly string[],
  className: string,
): Record<string, unknown> {
  const source = props as Record<string, unknown>;
  const attributes: Record<string, unknown> = { className };
  for (const key of Object.keys(source))
    if (!own.includes(key)) attributes[key] = source[key];
  return attributes;
}
