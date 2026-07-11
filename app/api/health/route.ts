import { getCapabilityReadiness } from "../../../lib/env";

export const runtime = "edge";

export async function GET() {
  return Response.json({
    ok: true,
    service: "nook-web",
    version: "phase-1",
    capabilities: getCapabilityReadiness(),
  }, { headers: { "cache-control": "no-store" } });
}
