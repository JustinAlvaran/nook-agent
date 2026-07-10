import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { taskEvents, tasks } from "../../../db/schema";
import { MissingOpenAIKeyError, createTaskPlan } from "../../../lib/agent/planner";
import { ensureProfileAndNook, getServerIdentity } from "../../../lib/server/identity";

export const runtime = "edge";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view saved tasks." }, { status: 401 });
  try {
    const db = getDb();
    const rows = await db.select().from(tasks).where(eq(tasks.ownerUserId, identity.userId)).orderBy(desc(tasks.createdAt)).limit(20);
    return Response.json({ tasks: rows.map((task) => ({ ...task, plan: task.planJson ? JSON.parse(task.planJson) : null })) });
  } catch {
    return Response.json({ error: "Saved task history is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to ask Nook to plan a task." }, { status: 401 });
  let body: { input?: unknown; nookName?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const nookName = typeof body.nookName === "string" ? body.nookName.trim().slice(0, 24) : "Orbit";
  if (!input || input.length > 1200) return Response.json({ error: "Enter a task between 1 and 1,200 characters." }, { status: 400 });

  try {
    const plan = await createTaskPlan(input);
    const id = `task_${crypto.randomUUID()}`;
    const status = plan.blocked ? "blocked" : plan.requiresApproval ? "awaiting_approval" : "ready";
    let persisted = false;
    try {
      const db = getDb();
      const nook = await ensureProfileAndNook(identity, nookName || "Orbit");
      await db.insert(tasks).values({ id, ownerUserId: identity.userId, nookId: nook.id, input, status, riskClass: plan.riskClass, planJson: JSON.stringify(plan), startedAt: new Date().toISOString() });
      await db.insert(taskEvents).values({ taskId: id, type: "plan.created", message: plan.summary, metadataJson: JSON.stringify({ riskClass: plan.riskClass, requiresApproval: plan.requiresApproval }) });
      persisted = true;
    } catch { /* Planning still succeeds when D1 is temporarily unavailable. */ }
    return Response.json({ task: { id, input, status, plan, persisted } });
  } catch (error) {
    if (error instanceof MissingOpenAIKeyError) {
      return Response.json({ error: "Nook's agent key has not been enabled for this environment yet.", code: "OPENAI_KEY_REQUIRED" }, { status: 503 });
    }
    return Response.json({ error: "Nook could not prepare a plan right now. Please try again." }, { status: 502 });
  }
}
