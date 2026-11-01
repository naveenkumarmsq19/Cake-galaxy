// Same-origin API forwarding. Never cache authenticated customer/admin API responses.
export async function onRequest({ request }) {
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, "https://cake-galaxy.onrender.com");
  const privatePath = /^\/api\/(?:auth|admin|session|checkout|orders|uploads|custom-requests|webhooks)(?:\/|$)/.test(incoming.pathname);
  try {
    const response = await fetch(new Request(upstream, request), { redirect: "manual" });
    const safe = new Response(response.body, response);
    safe.headers.set("X-Content-Type-Options", "nosniff");
    safe.headers.set("X-Frame-Options", "DENY");
    safe.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (privatePath) safe.headers.set("Cache-Control", "private, no-store");
    return safe;
  } catch {
    return Response.json(
      { error: "The store service is temporarily unavailable. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
    );
  }
}
