import Page from "@site-fragment/page";
import { prerender } from "react-dom/static";

export async function renderFragment() {
  const { prelude } = await prerender(<Page />);
  return new Response(prelude).text();
}
