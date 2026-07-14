import { validateMemoryContent } from "../../../lib/agent/memory-policy";
import { rejectCrossSiteMutation } from "../../../lib/server/request-security";
import {
  ensureProfileAndNook,
  getServerIdentity,
} from "../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "edge";
const kinds = new Set([
  "profile",
  "preference",
  "project",
  "workflow",
  "correction",
]);
export async function GET() {
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to review memory proposals." },
      { status: 401 },
    );
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Memory proposals are unavailable." },
      { status: 503 },
    );
  const { data, error } = await supabase
    .from("memory_proposals")
    .select(
      "id,nook_id,source_task_id,kind,title,content,reason,confidence,status,expires_at,created_at,reviewed_at",
    )
    .eq("owner_id", identity.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    return Response.json(
      { error: "Memory proposals could not be loaded." },
      { status: 503 },
    );
  return Response.json({ proposals: data ?? [] });
}
export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in before proposing a memory." },
      { status: 401 },
    );
  let body: {
    nookId?: unknown;
    sourceTaskId?: unknown;
    kind?: unknown;
    title?: unknown;
    content?: unknown;
    reason?: unknown;
    confidence?: unknown;
    nookName?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const checked = validateMemoryContent(
    typeof body.content === "string" ? body.content : "",
  );
  const kind = String(body.kind ?? "");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const confidence = Number(body.confidence);
  if (!checked.ok)
    return Response.json({ error: checked.error }, { status: 400 });
  if (
    !kinds.has(kind) ||
    title.length < 1 ||
    title.length > 120 ||
    reason.length < 1 ||
    reason.length > 300 ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  )
    return Response.json(
      { error: "Proposal fields are invalid." },
      { status: 400 },
    );
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Memory proposals are unavailable." },
      { status: 503 },
    );
  let nook: { id: string };
  try {
    nook = await ensureProfileAndNook(
      identity,
      typeof body.nookName === "string"
        ? body.nookName.trim().slice(0, 24) || "Orbit"
        : "Orbit",
    );
  } catch {
    return Response.json(
      { error: "Nook could not allocate a memory slot." },
      { status: 503 },
    );
  }
  const { data, error } = await supabase
    .from("memory_proposals")
    .insert({
      owner_id: identity.userId,
      nook_id: nook.id,
      source_task_id: body.sourceTaskId ? String(body.sourceTaskId) : null,
      kind,
      title,
      content: checked.content,
      reason,
      confidence,
      status: "proposed",
    })
    .select("*")
    .single();
  if (error)
    return Response.json(
      { error: "Memory proposal could not be saved." },
      { status: 503 },
    );
  return Response.json({ proposal: data }, { status: 201 });
}
