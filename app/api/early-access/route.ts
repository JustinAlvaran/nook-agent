import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { earlyAccess } from "../../../db/schema";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INTERESTS = new Set(["buyer", "creator", "both"]);

type EarlyAccessPayload = {
  email?: unknown;
  interest?: unknown;
};

function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${detail}`;

  if (
    combined.includes("no such table") ||
    combined.includes('into "early_access"')
  ) {
    return "Early access signups are not available yet.";
  }

  return message;
}

export async function POST(request: Request) {
  let payload: EarlyAccessPayload;

  try {
    payload = (await request.json()) as EarlyAccessPayload;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const interest =
    typeof payload.interest === "string" ? payload.interest.trim().toLowerCase() : "";

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!VALID_INTERESTS.has(interest)) {
    return Response.json(
      { error: "interest must be buyer, creator, or both." },
      { status: 400 }
    );
  }

  const buyerInterest = interest === "buyer" || interest === "both";
  const creatorInterest = interest === "creator" || interest === "both";

  try {
    const db = getDb();
    const [signup] = await db
      .insert(earlyAccess)
      .values({ email, buyerInterest, creatorInterest })
      .onConflictDoUpdate({
        target: earlyAccess.email,
        set: {
          buyerInterest: sql`MAX(${earlyAccess.buyerInterest}, excluded.buyer_interest)`,
          creatorInterest: sql`MAX(${earlyAccess.creatorInterest}, excluded.creator_interest)`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning();

    return Response.json({ signup }, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500 }
    );
  }
}
