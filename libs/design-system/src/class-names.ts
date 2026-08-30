/**
 * The class list a primitive renders: its own class first, then whatever the
 * app composing it adds. Falsy entries drop out, so a caller can pass a
 * conditional modifier without assembling the string itself.
 */
export function classNames(
  ...names: ReadonlyArray<string | false | undefined>
): string {
  return names.filter((name) => name !== undefined && name !== false).join(" ");
}
