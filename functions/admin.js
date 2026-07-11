const ADMIN_ORIGIN = "https://mirpanel-admin.onrender.com/";

export function onRequest() {
  return Response.redirect(ADMIN_ORIGIN, 302);
}
