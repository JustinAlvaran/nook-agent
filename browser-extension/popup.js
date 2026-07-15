const $ = (selector) => document.querySelector(selector);

async function message(payload) {
  return chrome.runtime.sendMessage(payload);
}

function short(value) {
  return value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "";
}

async function render() {
  const response = await message({ type: "status" });
  const state = response?.state || {};
  const paired = Boolean(state.deviceToken && state.deviceId);
  $("#unpaired").hidden = paired;
  $("#paired").hidden = !paired;
  $("#status").textContent = state.lastError || "";
  if (!paired) return;
  $("#device").textContent = `Device ${short(state.deviceId)} · last check ${state.lastSeenAt ? new Date(state.lastSeenAt).toLocaleTimeString() : "pending"}`;
  $("#receipt").textContent = state.lastReceipt
    ? `${state.lastReceipt.status === "succeeded" ? "✓" : "!"} ${state.lastReceipt.openedUrl || state.lastReceipt.error}`
    : "No browser task has run yet.";
}

$("#pair").addEventListener("click", async () => {
  const code = $("#code").value.trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code)) {
    $("#status").textContent = "Enter the eight-character code from Nook.";
    return;
  }
  $("#pair").disabled = true;
  $("#status").textContent = "Pairing and creating this browser’s signing key…";
  const result = await message({
    type: "pair",
    code,
    apiOrigin: $("#api-origin").value,
  });
  $("#pair").disabled = false;
  $("#status").textContent = result?.ok ? "Paired." : result?.error || "Pairing failed.";
  await render();
});

$("#wake").addEventListener("click", async () => {
  await message({ type: "wake" });
  $("#status").textContent = "Checking now…";
  setTimeout(render, 800);
});

$("#disconnect").addEventListener("click", async () => {
  await message({ type: "disconnect" });
  await render();
});

void render();

