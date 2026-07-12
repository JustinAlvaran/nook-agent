export const runtime = "edge";

export async function GET() {
  return Response.json({
    ok: true,
    service: "nook-web",
    version: "supervised-agent-mvp",
  }, { headers: { "cache-control": "no-store" } });
}
