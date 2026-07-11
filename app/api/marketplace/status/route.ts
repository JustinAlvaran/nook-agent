import { getCapabilityReadiness } from "../../../../lib/env";

export async function GET() {
  const ready = getCapabilityReadiness();
  return Response.json({
    catalog: "preview",
    checkout: ready.payments ? "test_mode_ready" : "owner_setup_required",
    creatorSelling: "coming_later",
    arbitraryCreatorCode: "not_supported",
  });
}
