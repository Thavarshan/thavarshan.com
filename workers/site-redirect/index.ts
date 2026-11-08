/** The www alias always points directly to the canonical origin. */
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.host = "thavarshan.com";
    return Response.redirect(url.href, 301);
  }
};
