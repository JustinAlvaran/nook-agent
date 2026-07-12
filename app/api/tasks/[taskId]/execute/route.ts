import { executeTask } from "../../../../../lib/server/execute-task";

export const runtime = "edge";
type Context = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: Context) {
  const { taskId } = await context.params;
  return executeTask(request, taskId);
}
