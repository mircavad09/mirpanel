const ADMIN_ORIGIN = "https://mirpanel-frankfurt.onrender.com/";

export function onRequest() {
  return Response.redirect(ADMIN_ORIGIN, 302);
}
