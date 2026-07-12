export function rejectCrossSiteMutation(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  return null;
}
