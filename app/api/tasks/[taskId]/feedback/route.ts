import { getServerIdentity } from "../../../../../lib/server/identity";
import { rejectCrossSiteMutation } from "../../../../../lib/server/request-security";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
export const runtime = "edge";
type Context = { params: Promise<{ taskId: string }> };
const allowed = new Set([
  "too_long",
  "too_short",
  "wrong_tone",
  "wrong_assumption",
  "missed_detail",
  "bad_source",
  "incorrect_classification",
  "wrong_tool",
  "do_not_remember",
  "remember_next_time",
]);
export async function POST(request: Request, context: Context) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to submit task feedback." },
      { status: 401 },
    );
  let body: {
    rating?: unknown;
    categories?: unknown;
    comment?: unknown;
    suggestedCorrection?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const rating = String(body.rating ?? "");
  const categories = Array.isArray(body.categories)
    ? body.categories.map(String)
    : [];
  const comment = typeof body.comment === "string" ? body.comment.trim() : null;
  const correction =
    typeof body.suggestedCorrection === "string"
      ? body.suggestedCorrection.trim()
      : null;
  if (
    !["positive", "negative"].includes(rating) ||
    categories.length > 10 ||
    categories.some((item) => !allowed.has(item)) ||
    (comment?.length ?? 0) > 1000 ||
    (correction?.length ?? 0) > 1000
  )
    return Response.json(
      { error: "Feedback fields are invalid." },
      { status: 400 },
    );
  const { taskId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Feedback is unavailable." },
      { status: 503 },
    );
  const { data, error } = await supabase
    .from("task_feedback")
    .insert({
      task_id: taskId,
      owner_id: identity.userId,
      rating,
      categories,
      comment,
      suggested_correction: correction,
    })
    .select("*")
    .single();
  if (error)
    return Response.json(
      { error: "Feedback could not be saved." },
      { status: 503 },
    );
  return Response.json({ feedback: data }, { status: 201 });
}
