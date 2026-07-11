/** The former prototype waitlist used D1. It is intentionally closed while Nook migrates to account-based onboarding. */
export async function POST() {
  return Response.json({ error: "The early-access waitlist is closed. Create a Nook account instead." }, { status: 410 });
}
