const rootStart = '<div id="root" data-prerendered-remote="awards">';
const rootEnd = '</div><script class="$tsr"';

export function rewriteStartAssetReferences(source: string): string {
  return source.replaceAll(/"\/(\d+\.[0-9a-f]+\.js)"/g, '"$1"');
}

export function extractStartFragment(document: string): string {
  const contentStart = document.indexOf(rootStart);
  const contentEnd = document.indexOf(rootEnd, contentStart + rootStart.length);
  if (contentStart < 0 || contentEnd < 0)
    throw new Error("Start emitted no extractable Awards prerender root");
  const startRoot = document.slice(contentStart + rootStart.length, contentEnd);
  const fragment = startRoot.replace(/^<!--\$-->(.*)<!--\/\$-->$/s, "$1");
  if (!fragment.includes('aria-label="Selected awards"'))
    throw new Error("Start prerender root contains no resolved Awards content");
  return fragment;
}
