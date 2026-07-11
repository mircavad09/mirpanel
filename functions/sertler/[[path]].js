import { renderSitePage } from "../_site-page.js";

export async function onRequest(context) {
  return renderSitePage(context, "sertler");
}
