import {
  authenticateBrowserDevice,
  verifyDeviceReceipt,
} from "../../../../../lib/browser/device-auth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "edge";

type BrowserReceipt = {
  commandId: string;
  actionHash: string;
  status: "succeeded" | "failed";
  openedTabId: number | null;
  openedUrl: string | null;
  completedAt: string;
  error: string | null;
};

export async function POST(request: Request) {
  const device = await authenticateBrowserDevice(request);
  if (!device)
    return Response.json({ error: "Browser device authentication failed." }, { status: 401 });
  let body: { receiptJson?: unknown; signature?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const receiptJson = typeof body.receiptJson === "string" ? body.receiptJson : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!receiptJson || receiptJson.length > 4096 || !signature)
    return Response.json({ error: "The browser receipt is invalid." }, { status: 400 });
  let receipt: BrowserReceipt;
  try {
    receipt = JSON.parse(receiptJson) as BrowserReceipt;
  } catch {
    return Response.json({ error: "The browser receipt is invalid." }, { status: 400 });
  }
  if (
    !/^[0-9a-f-]{36}$/i.test(receipt.commandId) ||
    !/^[0-9a-f]{32,128}$/i.test(receipt.actionHash) ||
    !["succeeded", "failed"].includes(receipt.status) ||
    !(
      receipt.openedTabId === null ||
      (Number.isInteger(receipt.openedTabId) && receipt.openedTabId >= 0)
    ) ||
    !(receipt.openedUrl === null ||
      (typeof receipt.openedUrl === "string" && receipt.openedUrl.length <= 2048)) ||
    !(receipt.error === null ||
      (typeof receipt.error === "string" && receipt.error.length <= 300)) ||
    !Number.isFinite(Date.parse(receipt.completedAt)) ||
    Date.now() - Date.parse(receipt.completedAt) > 60_000 ||
    Date.parse(receipt.completedAt) - Date.now() > 10_000
  )
    return Response.json({ error: "The browser receipt fields are invalid." }, { status: 400 });
  const verified = await verifyDeviceReceipt({
    publicKey: device.public_key,
    signature,
    receipt: JSON.parse(receiptJson),
  });
  if (!verified)
    return Response.json({ error: "The browser receipt signature is invalid." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  if (!admin)
    return Response.json({ error: "Browser command storage is unavailable." }, { status: 503 });
  const { data: command } = await admin
    .from("browser_commands")
    .select("id,task_id,action_hash,command,claimed_device_id,status,receipt_signature")
    .eq("id", receipt.commandId)
    .eq("claimed_device_id", device.id)
    .maybeSingle();
  const expectedUrl = (command?.command as { action?: { url?: unknown } } | null)?.action?.url;
  if (
    !command ||
    command.action_hash !== receipt.actionHash ||
    (receipt.status === "succeeded" && receipt.openedUrl !== expectedUrl)
  )
    return Response.json({ error: "The receipt does not match the claimed command." }, { status: 409 });
  if (
    (command.status === "succeeded" || command.status === "failed") &&
    command.receipt_signature === signature
  )
    return Response.json(
      { completed: true, replayed: true, task: { task_id: command.task_id } },
      { headers: { "cache-control": "no-store" } },
    );
  if (command.status !== "claimed")
    return Response.json({ error: "The browser command is no longer claimable." }, { status: 409 });
  const { data, error } = await admin.rpc("nook_finish_browser_command", {
    p_token_hash: device.tokenHash,
    p_command_id: receipt.commandId,
    p_status: receipt.status,
    p_result: receipt,
    p_receipt_signature: signature,
  });
  if (error)
    return Response.json({ error: "The browser receipt could not be committed." }, { status: 409 });
  const result = Array.isArray(data) ? data[0] : data;
  return Response.json({ completed: true, task: result }, { headers: { "cache-control": "no-store" } });
}
