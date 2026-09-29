export async function onRequest({ request }) {
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, "https://cake-galaxy.onrender.com");
  try {
    return await fetch(new Request(upstream, request), { redirect: "manual" });
  } catch {
    return Response.json({ error: "The store service is temporarily unavailable. Please try again." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
