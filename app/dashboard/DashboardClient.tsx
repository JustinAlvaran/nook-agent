"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LazyNook3D as Nook3D } from "../components/LazyNook3D";
import type {
  NookAccessory,
  NookAgentState,
  NookOutfit,
} from "../components/Nook3D";
import { deriveNookMotionSignal } from "../../lib/agent/nook-motion";
import { decideResearch, perceiveRequest } from "../../lib/agent/brain";

type PlanStep = {
  id: string;
  title: string;
  detail: string;
  kind: string;
  mode?: "instruction" | "tool";
  toolName?: string | null;
  toolVersion?: string | null;
  toolInput?: Record<string, unknown> | null;
  riskClass?: number;
  externalEffect?: boolean;
  requiresApproval: boolean;
};
type LivePlan = {
  summary: string;
  userMessage: string;
  riskClass: 0 | 1 | 2 | 3;
  requiresApproval: boolean;
  blocked: boolean;
  blockedReason: string;
  steps: PlanStep[];
};
type TaskOutput = {
  id?: string;
  summary: string;
  result_markdown: string;
  mode?: string;
  metadata?: {
    title?: string;
    whatChanged?: string[];
    nextSuggestedAction?: string;
  };
};
type TaskRecord = {
  id: string;
  input: string;
  status: string;
  createdAt?: string;
  plan?: LivePlan | null;
  output?: TaskOutput | null;
  task_outputs?: TaskOutput[];
  approvals?: LiveApproval[];
  action_receipts?: unknown[];
  task_events?: Array<{
    id: string;
    event_type: string;
    message: string;
    created_at: string;
  }>;
};
type LiveApproval = {
  id: string;
  action_hash: string;
  risk_class: number;
  expires_at: string;
  intent?: { destinationLabel?: string; preview?: string };
};
type Memory = {
  id: string;
  kind: "preference" | "instruction" | "context";
  content: string;
  source: string;
  created_at: string;
};
type MemorySuggestion = {
  kind: Memory["kind"];
  content: string;
  reason: string;
};
type MemoryProposal = {
  id: string;
  kind: string;
  title: string;
  content: string;
  reason: string;
  confidence: number;
  status: string;
  created_at: string;
};
type ConnectorState = {
  configured: boolean;
  connection: null | {
    account_email: string;
    scopes: string[];
    status: string;
    last_used_at?: string;
  };
};
type CatalogItem = {
  listing_id: string;
  name: string;
  description: string;
  kind: string;
  price_amount: number;
  currency: string;
  preview_asset_url?: string | null;
};
type ResearchSource = {
  id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string | null;
  retrieved_at: string;
  snippet: string;
};
type ResearchRun = {
  id: string;
  query: string;
  status: string;
  searched_at: string;
  research_sources: ResearchSource[];
};
type MemoryUsage = {
  reason: string;
  created_at: string;
  nook_memories: { id: string; kind: string; content: string } | null;
};

const sections = [
  { id: "home", label: "Room", icon: "⌂" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "memory", label: "Memory", icon: "◉" },
  { id: "connectors", label: "Connectors", icon: "↗" },
  { id: "wardrobe", label: "Wardrobe", icon: "◇" },
  { id: "marketplace", label: "Marketplace", icon: "+" },
  { id: "desktop", label: "Desktop", icon: "▣" },
] as const;
const starterItems = [
  { name: "Midnight hoodie", type: "Top", className: "hoodie" },
  { name: "Star pin", type: "Accessory", className: "star" },
  { name: "Cloud varsity", type: "Top", className: "varsity" },
];
const previewListings = [
  {
    name: "Mochi",
    maker: "Jun Park",
    kind: "Character pack",
    note: "Content and social working style",
  },
  {
    name: "File Tidy",
    maker: "Nook Labs",
    kind: "Skill preview",
    note: "Proposed access: chosen folders",
  },
  {
    name: "Focus cap",
    maker: "Soft Circuit",
    kind: "Cosmetic preview",
    note: "Visual item only",
  },
];

function stateMessage(state: NookAgentState, name: string) {
  if (state === "planning") return "I’m preparing the exact work now.";
  if (state === "running")
    return "I’m drafting, checking, and saving the result.";
  if (state === "needs_approval")
    return "I stopped for your exact permission. Review the ticket below.";
  if (state === "blocked") return "I stopped at the safety boundary.";
  if (state === "failed")
    return "That run failed safely. Nothing external changed.";
  if (state === "completed") return "The deliverable is ready and saved.";
  if (state === "offline") return "Desktop companion is not paired yet.";
  return `I’m ready when you are, ${name}.`;
}
function statusInfo(status: string) {
  if (status === "completed")
    return { icon: "✓", className: "complete", label: "completed" };
  if (status === "blocked" || status === "failed" || status === "cancelled")
    return { icon: "!", className: "blocked", label: status };
  if (status === "awaiting_approval")
    return { icon: "◷", className: "pending", label: "needs approval" };
  if (status === "running")
    return { icon: "•", className: "pending", label: "working" };
  return {
    icon: "→",
    className: "pending",
    label: status.replaceAll("_", " "),
  };
}
function outputFromTask(task: TaskRecord) {
  return (
    task.output ||
    (Array.isArray(task.task_outputs) ? task.task_outputs[0] : null) ||
    null
  );
}

export default function DashboardClient() {
  const pathname = usePathname();
  const routeSection = pathname.split("/")[2] || "home";
  const section = sections.some((item) => item.id === routeSection)
    ? routeSection
    : "home";
  const [command, setCommand] = useState("");
  const [clarification, setClarification] = useState<string[]>([]);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [clarified, setClarified] = useState(false);
  const [brainOpen, setBrainOpen] = useState(true);
  const [agentState, setAgentState] = useState<NookAgentState>("ready");
  const [status, setStatus] = useState("Ready for a new task");
  const [livePlan, setLivePlan] = useState<LivePlan | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeApproval, setActiveApproval] = useState<LiveApproval | null>(
    null,
  );
  const [activeOutput, setActiveOutput] = useState<TaskOutput | null>(null);
  const [memorySuggestion, setMemorySuggestion] =
    useState<MemorySuggestion | null>(null);
  const [history, setHistory] = useState<TaskRecord[] | null>(null);
  const [historyNotice, setHistoryNotice] = useState(
    "Loading real task history…",
  );
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [taskResearch, setTaskResearch] = useState<ResearchRun[]>([]);
  const [taskMemories, setTaskMemories] = useState<MemoryUsage[]>([]);
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [memoryKind, setMemoryKind] = useState<Memory["kind"]>("preference");
  const [memoryText, setMemoryText] = useState("");
  const [proposals, setProposals] = useState<MemoryProposal[] | null>(null);
  const [editingMemory, setEditingMemory] = useState<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = useState("");
  const [busy, setBusy] = useState(false);
  const [connector, setConnector] = useState<ConnectorState | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [claimedListings, setClaimedListings] = useState<string[]>([]);
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [appearance, setAppearance] = useState({
    name: "Orbit",
    primary: "#617fff",
    secondary: "#9db0ff",
    glow: "#7debff",
    outfit: "hoodie" as NookOutfit,
    accessory: "star" as NookAccessory,
  });
  const motionSignal = useMemo(
    () =>
      deriveNookMotionSignal(
        agentState,
        livePlan?.steps.find((step) => step.mode === "tool")?.toolName,
      ),
    [agentState, livePlan],
  );
  const perception = useMemo(() => perceiveRequest(command), [command]);
  const researchDecision = useMemo(
    () => decideResearch(perception),
    [perception],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/nooks");
        const result = await response.json();
        if (response.ok && result.nook && !cancelled) {
          const versions = result.nook.appearance_versions || [];
          const active =
            versions.find(
              (item: { id: string }) =>
                item.id === result.nook.active_appearance_id,
            ) || versions.at(-1);
          setAppearance({
            name: result.nook.name || "Orbit",
            primary: active?.primary_color || "#617fff",
            secondary: active?.secondary_color || "#9db0ff",
            glow: active?.face_glow || "#7debff",
            outfit: active?.outfit_id || "hoodie",
            accessory: active?.accessory_ids?.[0] || "none",
          });
          return;
        }
      } catch {}
      const saved = window.localStorage.getItem("nook-creator-draft");
      if (saved && !cancelled)
        try {
          const draft = JSON.parse(saved);
          setAppearance({
            name: draft.name || "Orbit",
            primary: draft.color?.primary || "#617fff",
            secondary: draft.color?.secondary || "#9db0ff",
            glow: draft.color?.glow || "#7debff",
            outfit: draft.outfit || "hoodie",
            accessory: draft.accessory || "star",
          });
        } catch {}
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tasks")
      .then(async (r) => {
        const result = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setHistory([]);
          setHistoryNotice(result.error || "Task history is unavailable.");
          return;
        }
        setHistory(result.tasks || []);
        setHistoryNotice("");
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
          setHistoryNotice("Task history is temporarily unavailable.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (section !== "memory" || memories) return;
    let cancelled = false;
    void fetch("/api/memories")
      .then(async (r) => {
        const result = await r.json();
        if (!cancelled) setMemories(r.ok ? result.memories || [] : []);
      })
      .catch(() => {
        if (!cancelled) setMemories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section, memories]);
  useEffect(() => {
    if (section !== "memory" || proposals) return;
    let cancelled = false;
    void fetch("/api/memory-proposals")
      .then(async (response) => {
        const result = await response.json();
        if (!cancelled) setProposals(response.ok ? result.proposals || [] : []);
      })
      .catch(() => {
        if (!cancelled) setProposals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section, proposals]);
  useEffect(() => {
    if (section !== "connectors" || connector) return;
    void fetch("/api/integrations/google")
      .then(async (r) => {
        const result = await r.json();
        setConnector(
          r.ok
            ? (result as ConnectorState)
            : { configured: false, connection: null },
        );
      })
      .catch(() => setConnector({ configured: false, connection: null }));
  }, [section, connector]);
  useEffect(() => {
    if (section !== "marketplace" || catalog) return;
    void fetch("/api/marketplace/catalog")
      .then(async (r) => {
        const result = await r.json();
        setCatalog(r.ok ? result.items || [] : []);
      })
      .catch(() => setCatalog([]));
  }, [section, catalog]);

  async function runCommand() {
    if (!command.trim() || busy) return;
    if (perception.needsClarification && !clarified) {
      setClarification(perception.missingInformation);
      setAgentState("needs_input");
      setStatus(
        "I need a few real details before I can make a trustworthy plan.",
      );
      return;
    }
    setBusy(true);
    setAgentState("planning");
    setLivePlan(null);
    setActiveApproval(null);
    setActiveOutput(null);
    setMemorySuggestion(null);
    setStatus("Preparing a truthful, saved plan…");
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: command, nookName: appearance.name }),
      });
      if (r.status === 401) {
        window.location.href = `/auth/sign-in?next=${encodeURIComponent("/dashboard")}`;
        return;
      }
      const result = await r.json();
      if (!r.ok || !result.task)
        throw new Error(result.error || "Nook could not prepare a plan.");
      setLivePlan(result.task.plan);
      setActiveTaskId(result.task.id);
      setActiveApproval(result.task.approval || null);
      setAgentState(
        result.task.plan.blocked
          ? "blocked"
          : result.task.plan.requiresApproval
            ? "needs_approval"
            : "ready",
      );
      setStatus(
        result.task.plan.blocked
          ? "Stopped safely."
          : result.task.plan.requiresApproval
            ? "Plan saved. Review the exact permission ticket."
            : "Plan saved. The allowlisted tool is ready.",
      );
      setHistory((items) => [
        {
          id: result.task.id,
          input: result.task.input,
          status: result.task.status,
          plan: result.task.plan,
          approvals: result.task.approval ? [result.task.approval] : [],
        },
        ...(items || []),
      ]);
    } catch (e) {
      setAgentState("failed");
      setStatus(e instanceof Error ? e.message : "Planning failed safely.");
    } finally {
      setBusy(false);
    }
  }
  function submitClarification() {
    if (!clarificationAnswer.trim()) return;
    setCommand(
      (value) =>
        `${value}\n\nDetails supplied by the user:\n${clarificationAnswer.trim()}`,
    );
    setClarification([]);
    setClarificationAnswer("");
    setClarified(true);
    setAgentState("ready");
    setStatus(
      "Thanks. Those details are now part of this task request; nothing has run yet.",
    );
  }
  async function workTask(taskId = activeTaskId) {
    if (!taskId || busy || activeApproval) return;
    setBusy(true);
    setAgentState("running");
    setStatus("Nook is running one allowlisted tool and verifying the result…");
    try {
      let result: Record<string, unknown> | null = null;
      for (let stepNumber = 1; stepNumber <= 3; stepNumber += 1) {
        setStatus(`Running and verifying step ${stepNumber} of at most 3…`);
        const response = await fetch(`/api/tasks/${taskId}/execute`, {
          method: "POST",
        });
        result = (await response.json()) as Record<string, unknown>;
        if (!response.ok)
          throw new Error(
            String(result.error || "Nook could not finish this work."),
          );
        if (result.completed) break;
      }
      if (!result || !result.completed)
        throw new Error("The bounded plan did not reach verified completion.");
      const resultOutput = result.output as TaskOutput & {
        resultMarkdown?: string;
        title?: string;
        whatChanged?: string[];
        nextSuggestedAction?: string;
      };
      const output: TaskOutput = {
        ...resultOutput,
        summary: resultOutput.summary,
        result_markdown:
          resultOutput.result_markdown || resultOutput.resultMarkdown || "",
        metadata: resultOutput.metadata || {
          title: resultOutput.title,
          whatChanged: resultOutput.whatChanged,
          nextSuggestedAction: resultOutput.nextSuggestedAction,
        },
      };
      setActiveOutput(output);
      setMemorySuggestion(null);
      if (result.memoryProposal)
        setProposals((items) => [
          result.memoryProposal as MemoryProposal,
          ...(items || []),
        ]);
      setAgentState("completed");
      setStatus("Verified result saved with an execution receipt.");
      setHistory((items) =>
        (items || []).map((t) =>
          t.id === taskId ? { ...t, status: "completed", output } : t,
        ),
      );
    } catch (e) {
      setAgentState("failed");
      setStatus(e instanceof Error ? e.message : "The run failed safely.");
    } finally {
      setBusy(false);
    }
  }
  async function decideApproval(decision: "approve" | "reject") {
    if (!activeTaskId || !activeApproval || busy) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/tasks/${activeTaskId}/approvals/${activeApproval.id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision,
            actionHash: activeApproval.action_hash,
          }),
        },
      );
      const result = await r.json();
      if (!r.ok)
        throw new Error(result.error || "The decision could not be recorded.");
      setActiveApproval(null);
      setAgentState(decision === "approve" ? "ready" : "blocked");
      setStatus(
        decision === "approve"
          ? "Approved once. The exact hash-bound tool is ready; nothing ran yet."
          : "Rejected. No tool ran and nothing external changed.",
      );
      setHistory((items) =>
        (items || []).map((t) =>
          t.id === activeTaskId
            ? {
                ...t,
                status: decision === "approve" ? "ready" : "blocked",
                approvals: [],
              }
            : t,
        ),
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }
  async function openTask(id: string) {
    const [r, researchResponse, memoryResponse] = await Promise.all([
      fetch(`/api/tasks/${id}`),
      fetch(`/api/tasks/${id}/research`),
      fetch(`/api/tasks/${id}/memories-used`),
    ]);
    const [result, researchResult, memoryResult] = await Promise.all([
      r.json(),
      researchResponse.json(),
      memoryResponse.json(),
    ]);
    if (!r.ok) {
      setStatus(result.error || "Task unavailable.");
      return;
    }
    const task = result.task as TaskRecord;
    setTaskResearch(researchResponse.ok ? researchResult.research || [] : []);
    setTaskMemories(memoryResponse.ok ? memoryResult.memoriesUsed || [] : []);
    setSelectedTask(task);
    setActiveTaskId(task.id);
    setLivePlan(task.plan || null);
    setActiveOutput(outputFromTask(task));
    setActiveApproval(
      task.approvals?.find(
        (item) =>
          (item as LiveApproval & { status?: string }).status === "pending",
      ) || null,
    );
    setAgentState(
      task.status === "completed"
        ? "completed"
        : task.status === "awaiting_approval"
          ? "needs_approval"
          : task.status === "running"
            ? "running"
            : task.status === "blocked"
              ? "blocked"
              : task.status === "failed"
                ? "failed"
                : "ready",
    );
    setStatus(
      `Recovered ${statusInfo(task.status).label} task from durable history.`,
    );
  }
  async function transitionTask(id: string, action: "cancel" | "retry") {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await r.json();
      if (!r.ok)
        throw new Error(result.error || "Task state could not be changed.");
      const next = result.task.status as string;
      setHistory((items) =>
        (items || []).map((task) =>
          task.id === id ? { ...task, status: next } : task,
        ),
      );
      if (selectedTask?.id === id)
        setSelectedTask({ ...selectedTask, status: next });
      if (activeTaskId === id) {
        setAgentState(next === "cancelled" ? "blocked" : "ready");
        setActiveApproval(null);
      }
      setStatus(
        next === "cancelled"
          ? "Task cancelled. Pending work stopped."
          : "Task reset for a bounded retry.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Task transition failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remember(
    kind = memoryKind,
    content = memoryText,
    source: "taught" | "task" = "taught",
  ) {
    if (!content.trim()) return;
    const r = await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, content, source }),
    });
    const result = await r.json();
    if (!r.ok) {
      setStatus(result.error || "Memory could not be saved.");
      return;
    }
    setMemories((items) => [result.memory, ...(items || [])]);
    setMemoryText("");
    setMemorySuggestion(null);
    setStatus("Saved. Nook will use this on future tasks.");
  }
  async function forget(id: string) {
    const r = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    if (r.ok)
      setMemories((items) => (items || []).filter((item) => item.id !== id));
  }
  async function updateMemory(id: string) {
    const content = editingMemoryText.trim();
    if (content.length < 2) return;
    const r = await fetch(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const result = await r.json();
    if (!r.ok) {
      setStatus(result.error || "Memory could not be updated.");
      return;
    }
    setMemories((items) =>
      (items || []).map((item) => (item.id === id ? result.memory : item)),
    );
    setEditingMemory(null);
    setEditingMemoryText("");
    setStatus("Memory updated. Future tasks will use the corrected version.");
  }
  async function reviewProposal(id: string, decision: "approve" | "reject") {
    const response = await fetch(`/api/memory-proposals/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error || "Proposal could not be reviewed.");
      return;
    }
    setProposals((items) =>
      (items || []).map((item) =>
        item.id === id
          ? { ...item, status: decision === "approve" ? "active" : "rejected" }
          : item,
      ),
    );
    setMemories(null);
    setStatus(
      decision === "approve"
        ? "Memory approved and active."
        : "Memory proposal rejected. It will not be used.",
    );
  }
  async function sendFeedback(rating: "positive" | "negative") {
    if (!activeTaskId) return;
    const response = await fetch(`/api/tasks/${activeTaskId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rating,
        categories: rating === "negative" ? ["missed_detail"] : [],
      }),
    });
    setStatus(
      response.ok
        ? "Feedback saved. It will not become memory without a separate proposal and approval."
        : "Feedback could not be saved.",
    );
  }
  async function createPairing() {
    const r = await fetch("/api/desktop/pairings", { method: "POST" });
    const result = await r.json();
    if (r.ok && result.code)
      setPairing({ code: result.code, expiresAt: result.expiresAt });
    else setStatus(result.error || "Pairing is unavailable.");
  }
  async function claimListing(listingId: string) {
    const r = await fetch("/api/marketplace/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const result = await r.json();
    if (!r.ok) {
      setStatus(result.error || "Item unavailable.");
      return;
    }
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    setClaimedListings((items) => [...new Set([...items, listingId])]);
    setStatus("Added to your durable inventory.");
  }

  const currentMessage = stateMessage(agentState, appearance.name);
  const heading = useMemo(
    () => sections.find((item) => item.id === section)?.label || "Room",
    [section],
  );
  const resultWorkbench = activeOutput && (
    <section className="result-workbench">
      <header>
        <div>
          <span className="surface-label live">SAVED DELIVERABLE</span>
          <h2>{activeOutput.metadata?.title || activeOutput.summary}</h2>
          <p>{activeOutput.summary}</p>
        </div>
        <em>
          {activeOutput.mode === "draft_only"
            ? "Draft only · no external effect"
            : "Local result · saved"}
        </em>
      </header>
      <pre>{activeOutput.result_markdown}</pre>
      {activeOutput.metadata?.whatChanged?.length ? (
        <div className="result-changes">
          <b>Work produced</b>
          <ul>
            {activeOutput.metadata.whatChanged.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {activeOutput.metadata?.nextSuggestedAction && (
        <div className="result-next">
          <b>Suggested next step</b>
          <p>{activeOutput.metadata.nextSuggestedAction}</p>
        </div>
      )}
      {memorySuggestion && (
        <div className="memory-suggestion">
          <div>
            <span className="surface-label preview">MEMORY SUGGESTION</span>
            <b>Should I remember this?</b>
            <p>{memorySuggestion.content}</p>
            <small>{memorySuggestion.reason}</small>
          </div>
          <button onClick={() => setMemorySuggestion(null)}>Not now</button>
          <button
            onClick={() =>
              remember(memorySuggestion.kind, memorySuggestion.content, "task")
            }
          >
            Remember this
          </button>
        </div>
      )}
      <div className="result-feedback">
        <b>Was this useful?</b>
        <button onClick={() => sendFeedback("positive")}>Yes</button>
        <button onClick={() => sendFeedback("negative")}>
          Needs correction
        </button>
      </div>
    </section>
  );
  const room = (
    <>
      <PageHead
        eyebrow="Nook control room"
        title={`${appearance.name} is ready to make something useful.`}
        copy="Request → allowlisted plan → approval when needed → verified receipt."
        action={
          <Link className="dash-closet-link" href="/dashboard/wardrobe">
            Wardrobe
          </Link>
        }
      />
      <section className="control-room-card">
        <div className={`room-presence focus-${motionSignal.focusTarget}`}>
          <span className={`truth-status status-${agentState}`}>
            <i />
            {motionSignal.state}
          </span>
          <Nook3D
            compact
            name={appearance.name}
            primary={appearance.primary}
            secondary={appearance.secondary}
            faceGlow={appearance.glow}
            outfit={appearance.outfit}
            accessory={appearance.accessory}
            agentState={agentState}
            signal={motionSignal}
            message={currentMessage}
          />
          <div className="brain-readout">
            <b>{motionSignal.state}</b>
            <span>
              {motionSignal.focusTarget === "none"
                ? "No active target"
                : `Focused on ${motionSignal.focusTarget}`}
            </span>
          </div>
          <p>
            Movement reflects saved task state. Nook does not pretend to work
            while idle.
          </p>
        </div>
        <div className="room-composer">
          <label htmlFor="nook-command">
            What should {appearance.name} help you make or solve?
          </label>
          <textarea
            id="nook-command"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setClarified(false);
              setClarification([]);
            }}
            placeholder="Draft a launch plan, guide me through a Facebook Page, or make Nook more concise"
            maxLength={1200}
          />
          <div>
            <small>{command.length}/1200 · plans and results are saved</small>
            <button onClick={runCommand} disabled={!command.trim() || busy}>
              {agentState === "planning" ? "Planning…" : "Prepare plan →"}
            </button>
          </div>
          <p role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </section>
      {clarification.length > 0 && (
        <section className="clarification-card">
          <div>
            <span className="surface-label preview">NO GUESSING</span>
            <h2>I need these details first</h2>
            <ul>
              {clarification.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <textarea
            value={clarificationAnswer}
            onChange={(event) => setClarificationAnswer(event.target.value)}
            placeholder="Add the missing facts here. Nook will use only what you provide."
            maxLength={1200}
          />
          <button
            onClick={submitClarification}
            disabled={!clarificationAnswer.trim()}
          >
            Use these details
          </button>
        </section>
      )}
      <section className={`brain-panel ${brainOpen ? "is-open" : ""}`}>
        <button
          className="brain-panel-toggle"
          onClick={() => setBrainOpen((value) => !value)}
          aria-expanded={brainOpen}
        >
          <span>
            <i />
            What Nook understands
          </span>
          <b>{brainOpen ? "Hide" : "Show"}</b>
        </button>
        {brainOpen && (
          <div className="brain-panel-grid">
            <article>
              <small>Intent</small>
              <b>{perception.probableIntent.replaceAll("_", " ")}</b>
              <span>
                {Math.round(perception.confidence * 100)}% request match
              </span>
            </article>
            <article>
              <small>Current research</small>
              <b>{researchDecision.required ? "Required" : "Not required"}</b>
              <span>{researchDecision.reason}</span>
            </article>
            <article>
              <small>Memory</small>
              <b>{memories?.length ?? 0} active</b>
              <span>Only approved, relevant memories may be used.</span>
            </article>
            <article>
              <small>External effects</small>
              <b>None</b>
              <span>Planning never publishes or changes another service.</span>
            </article>
            {livePlan && (
              <article className="brain-plan-tools">
                <small>Selected tools</small>
                <b>
                  {livePlan.steps
                    .filter((step) => step.toolName)
                    .map((step) => step.toolName)
                    .join(" → ") || "No tool"}
                </b>
                <span>Maximum three dependent tool steps.</span>
              </article>
            )}
          </div>
        )}
      </section>
      {livePlan ? (
        <section
          className={`task-drawer ${livePlan.blocked ? "is-blocked" : ""}`}
        >
          <header>
            <div>
              <span className="surface-label live">PREPARED PLAN</span>
              <h2>{livePlan.summary}</h2>
              <p>
                {livePlan.blocked
                  ? livePlan.blockedReason
                  : livePlan.userMessage}
              </p>
            </div>
            <em>
              Risk {livePlan.riskClass} ·{" "}
              {livePlan.requiresApproval
                ? "Exact approval required"
                : "Local allowlisted work"}
            </em>
          </header>
          {!livePlan.blocked && (
            <div className="worker-track">
              {livePlan.steps.map((step, index) => (
                <article
                  key={step.id}
                  className={
                    busy
                      ? "is-running"
                      : activeOutput
                        ? "is-complete"
                        : "is-queued"
                  }
                >
                  <span>{index + 1}</span>
                  <div>
                    <b>{step.title}</b>
                    <small>{step.detail}</small>
                    <i>
                      {step.toolName
                        ? `${step.toolName} v${step.toolVersion || "1"} · risk ${step.riskClass ?? 0}`
                        : "Instruction only"}
                      {step.requiresApproval ? " · approval required" : ""}
                    </i>
                    <em>
                      {busy
                        ? "Working and checking"
                        : activeOutput
                          ? "Verified"
                          : "Queued"}
                    </em>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!livePlan.blocked && !activeOutput && activeApproval && (
            <section className="approval-ticket">
              <div>
                <span className="surface-label live">PERMISSION TICKET</span>
                <h3>
                  {activeApproval.intent?.destinationLabel || "This Nook only"}
                </h3>
                <p>{activeApproval.intent?.preview}</p>
                <small>
                  Approval is hash-bound, expires, and does not execute the tool
                  by itself.
                </small>
              </div>
              <button onClick={() => decideApproval("reject")} disabled={busy}>
                Reject
              </button>
              <button onClick={() => decideApproval("approve")} disabled={busy}>
                Approve once
              </button>
            </section>
          )}
          {!livePlan.blocked && !activeOutput && !activeApproval && (
            <div className="plan-run">
              <div>
                <b>Ready to run the saved tool</b>
                <p>
                  {livePlan.requiresApproval
                    ? "Your one-time approval is recorded. Nook will now execute only the unchanged arguments."
                    : "Nook will produce, verify, and save one local result."}
                </p>
              </div>
              <button onClick={() => workTask()} disabled={busy}>
                {busy ? "Working…" : "Execute saved tool"}
              </button>
            </div>
          )}
          <footer className="plan-receipt">
            <div>
              <span className="surface-label live">PLAN RECEIPT</span>
              <b>Plan saved</b>
              <small>No tool or connector ran while preparing this plan.</small>
            </div>
          </footer>
        </section>
      ) : (
        <section className="honest-empty">
          <span className="surface-label live">READY</span>
          <h2>No task is active.</h2>
          <p>
            Give Nook a concrete outcome. It will show the exact tool and inputs
            before running.
          </p>
        </section>
      )}
      {resultWorkbench}
    </>
  );
  const tasks = (
    <section className="dash-page">
      <PageHead
        eyebrow="Durable work and receipts"
        title="Tasks"
        copy="Open any real task to recover its plan, timeline, approval, and verified result."
      />
      {history === null ? (
        <Empty title="Loading task history…" />
      ) : history.length ? (
        <div className="task-table truthful-task-table">
          <div className="task-table-head">
            <span>Request</span>
            <span>Status</span>
            <span>When</span>
            <span>Result</span>
          </div>
          {history.map((task) => {
            const info = statusInfo(task.status);
            return (
              <button
                className="task-table-row"
                key={task.id}
                onClick={() => openTask(task.id)}
              >
                <span>
                  <i>{info.icon}</i>
                  <b>{task.input}</b>
                </span>
                <em className={info.className}>{info.label}</em>
                <small>
                  {task.createdAt
                    ? new Date(task.createdAt).toLocaleString()
                    : "Current session"}
                </small>
                <span className="receipt-state">
                  {outputFromTask(task)
                    ? "Open result"
                    : task.plan
                      ? "Open plan"
                      : "Open record"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No saved tasks yet."
          copy={historyNotice || "Create your first task in the room."}
        />
      )}
      {selectedTask && (
        <section className="task-detail">
          <button
            onClick={() => setSelectedTask(null)}
            aria-label="Close task detail"
          >
            ×
          </button>
          <span className="surface-label live">TASK RECORD</span>
          <h2>{selectedTask.input}</h2>
          <p>Status: {statusInfo(selectedTask.status).label}</p>
          {outputFromTask(selectedTask) ? (
            <pre>{outputFromTask(selectedTask)?.result_markdown}</pre>
          ) : (
            <p>No verified deliverable has been generated yet.</p>
          )}
          {taskMemories.length > 0 && (
            <section className="task-memory-audit">
              <span className="surface-label live">MEMORIES USED</span>
              {taskMemories.map((item) => (
                <article key={`${item.nook_memories?.id}-${item.created_at}`}>
                  <b>{item.nook_memories?.kind || "Memory"}</b>
                  <p>{item.nook_memories?.content}</p>
                  <small>{item.reason}</small>
                </article>
              ))}
            </section>
          )}
          {taskResearch.flatMap((run) => run.research_sources || []).length >
            0 && (
            <section className="source-viewer">
              <header>
                <span className="surface-label live">SOURCES</span>
                <b>
                  {
                    taskResearch.flatMap((run) => run.research_sources || [])
                      .length
                  }{" "}
                  saved sources
                </b>
              </header>
              {taskResearch
                .flatMap((run) => run.research_sources || [])
                .map((source) => (
                  <article key={source.id}>
                    <div>
                      <small>
                        {source.source_name} ·{" "}
                        {source.published_at
                          ? new Date(source.published_at).toLocaleDateString()
                          : "Publication date unknown"}
                      </small>
                      <b>{source.title}</b>
                      <p>{source.snippet}</p>
                    </div>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Open source
                    </a>
                  </article>
                ))}
            </section>
          )}
          {selectedTask.task_events?.length ? (
            <ol className="task-event-list">
              {selectedTask.task_events
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((event) => (
                  <li key={event.id}>
                    <b>{event.event_type.replaceAll(".", " ")}</b>
                    <span>{event.message}</span>
                    <time>{new Date(event.created_at).toLocaleString()}</time>
                  </li>
                ))}
            </ol>
          ) : null}
          <div className="task-detail-actions">
            {selectedTask.status === "ready" && (
              <button
                className="dash-primary"
                onClick={() => workTask(selectedTask.id)}
                disabled={busy}
              >
                Execute saved tool
              </button>
            )}
            {selectedTask.status === "failed" && (
              <button
                className="dash-primary"
                onClick={() => transitionTask(selectedTask.id, "retry")}
                disabled={busy}
              >
                Prepare retry
              </button>
            )}
            {["ready", "running", "awaiting_approval"].includes(
              selectedTask.status,
            ) && (
              <button
                onClick={() => transitionTask(selectedTask.id, "cancel")}
                disabled={busy}
              >
                Cancel task
              </button>
            )}
            {selectedTask.status === "awaiting_approval" && (
              <Link className="dash-primary link-button" href="/dashboard">
                Review permission in room
              </Link>
            )}
          </div>
        </section>
      )}
    </section>
  );
  const memory = (
    <section className="dash-page">
      <PageHead
        eyebrow="User-controlled learning"
        title={`What ${appearance.name} knows`}
        copy="Teach, correct, or remove memories yourself. Nook never learns silently."
      />
      <div className="memory-teach">
        <div>
          <span className="surface-label live">TEACH NOOK</span>
          <h2>Add something worth remembering</h2>
          <p>
            Use preferences for style, instructions for standing rules, and
            context for stable facts about your work.
          </p>
        </div>
        <select
          value={memoryKind}
          onChange={(e) => setMemoryKind(e.target.value as Memory["kind"])}
          aria-label="Memory type"
        >
          <option value="preference">Preference</option>
          <option value="instruction">Instruction</option>
          <option value="context">Context</option>
        </select>
        <textarea
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
          maxLength={500}
          placeholder="Example: Keep launch copy concise and avoid exaggerated claims."
        />
        <button
          onClick={() => remember()}
          disabled={memoryText.trim().length < 2}
        >
          Teach Nook
        </button>
      </div>
      <section className="memory-proposals">
        <span className="surface-label preview">AWAITING YOUR DECISION</span>
        <h2>Suggested memories</h2>
        {proposals === null ? (
          <p>Loading proposals…</p>
        ) : proposals.filter((item) => item.status === "proposed").length ? (
          proposals
            .filter((item) => item.status === "proposed")
            .map((item) => (
              <article key={item.id}>
                <div>
                  <b>{item.title}</b>
                  <p>{item.content}</p>
                  <small>
                    {item.reason} · confidence{" "}
                    {Math.round(item.confidence * 100)}%
                  </small>
                </div>
                <button onClick={() => reviewProposal(item.id, "reject")}>
                  Reject
                </button>
                <button onClick={() => reviewProposal(item.id, "approve")}>
                  Approve
                </button>
              </article>
            ))
        ) : (
          <p>
            No memory proposals are waiting. Nook will never activate one
            without you.
          </p>
        )}
      </section>
      <div className="memory-list">
        {memories === null ? (
          <Empty title="Loading memory…" />
        ) : memories.length ? (
          memories.map((item) => (
            <article key={item.id}>
              <span className="surface-label preview">
                {item.kind.toUpperCase()}
              </span>
              {editingMemory === item.id ? (
                <>
                  <textarea
                    className="memory-edit"
                    value={editingMemoryText}
                    onChange={(e) => setEditingMemoryText(e.target.value)}
                    maxLength={500}
                    autoFocus
                  />
                  <div className="memory-actions">
                    <button
                      onClick={() => {
                        setEditingMemory(null);
                        setEditingMemoryText("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateMemory(item.id)}
                      disabled={editingMemoryText.trim().length < 2}
                    >
                      Save correction
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{item.content}</p>
                  <small>
                    {item.source === "taught"
                      ? "Taught by you"
                      : "Approved from a task"}{" "}
                    · {new Date(item.created_at).toLocaleDateString()}
                  </small>
                  <div className="memory-actions">
                    <button
                      onClick={() => {
                        setEditingMemory(item.id);
                        setEditingMemoryText(item.content);
                      }}
                    >
                      Edit
                    </button>
                    <button onClick={() => forget(item.id)}>Forget</button>
                  </div>
                </>
              )}
            </article>
          ))
        ) : (
          <Empty
            title="Nook’s memory is empty."
            copy="That is normal. Add only stable context you want reused."
          />
        )}
      </div>
    </section>
  );
  const connectors = (
    <section className="dash-page">
      <PageHead
        eyebrow="Controlled doorways"
        title="Connectors"
        copy="Sign-in and connected services stay separate."
      />
      <div className="connector-grid">
        <article>
          <div className="connector-mark google">G</div>
          <span
            className={`surface-label ${connector?.connection ? "live" : "preview"}`}
          >
            {connector?.connection
              ? "CONNECTED"
              : connector?.configured
                ? "READY TO CONNECT"
                : "SETUP REQUIRED"}
          </span>
          <h2>Google Workspace</h2>
          <p>
            {connector?.connection
              ? `${connector.connection.account_email} · ${connector.connection.status}`
              : "Drive, Docs, Gmail drafts, and Calendar use incremental permissions."}
          </p>
          {connector?.connection ? (
            <button
              onClick={async () => {
                await fetch("/api/integrations/google", { method: "DELETE" });
                setConnector(null);
              }}
            >
              Revoke connection
            </button>
          ) : connector?.configured ? (
            <a
              className="dash-primary link-button"
              href="/api/integrations/google/connect?capability=read"
            >
              Connect read-only Google
            </a>
          ) : (
            <button disabled>Dedicated OAuth client required</button>
          )}
        </article>
        <article className="connector-future">
          <span className="surface-label later">COMING LATER</span>
          <h2>More connectors</h2>
          <p>Facebook Pages follows after the core task loop is verified.</p>
        </article>
      </div>
    </section>
  );
  const wardrobe = (
    <section className="dash-page">
      <PageHead
        eyebrow="Cosmetics are cosmetic"
        title="Wardrobe"
        copy="Starter pieces change appearance, never permissions."
        action={
          <Link className="dash-primary link-button" href="/create">
            Customize Nook
          </Link>
        }
      />
      <div className="wardrobe-owned">
        {starterItems.map((item) => (
          <article key={item.name}>
            <div className={`wardrobe-thumb ${item.className}`} />
            <span className="surface-label preview">STARTER</span>
            <h3>{item.name}</h3>
            <p>{item.type}</p>
          </article>
        ))}
      </div>
    </section>
  );
  const marketplaceItems = catalog?.length
    ? catalog.map((item) => ({
        name: item.name,
        maker: "Nook Labs",
        kind: item.kind,
        note: item.description,
        listingId: item.listing_id,
        price:
          item.price_amount === 0
            ? "Free"
            : `${item.currency} ${(item.price_amount / 100).toFixed(2)}`,
      }))
    : previewListings.map((item) => ({
        ...item,
        listingId: "",
        price: "Preview",
      }));
  const marketplace = (
    <section className="dash-page">
      <PageHead
        eyebrow="Curated catalog"
        title="Marketplace preview"
        copy="Platform-owned items first. Paid checkout stays off until verified payments are ready."
      />
      <div className="preview-market">
        {marketplaceItems.map((item) => (
          <article key={item.name}>
            <span
              className={`surface-label ${catalog?.length ? "live" : "preview"}`}
            >
              {catalog?.length ? "LIVE CATALOG" : "CONCEPT"}
            </span>
            <div className="listing-art">&gt;_</div>
            <h3>{item.name}</h3>
            <b>
              by {item.maker} · {item.price}
            </b>
            <p>
              {item.kind} · {item.note}
            </p>
            <button
              disabled={
                !item.listingId || claimedListings.includes(item.listingId)
              }
              onClick={() => item.listingId && claimListing(item.listingId)}
            >
              {claimedListings.includes(item.listingId)
                ? "Added"
                : item.listingId
                  ? item.price === "Free"
                    ? "Add free item"
                    : "Open test checkout"
                  : "Preview only"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
  const desktop = (
    <section className="dash-page">
      <PageHead
        eyebrow="Windows-first"
        title="Desktop companion"
        copy="A signed desktop Nook will mirror the same durable task state."
      />
      <div className="desktop-preview">
        <div>
          <span className="surface-label preview">PAIRING FOUNDATION</span>
          <h2>Bring {appearance.name} to your screen</h2>
          <ul>
            <li>One-time pairing code</li>
            <li>Pause, hide, mute, and emergency stop</li>
            <li>Multi-monitor-safe movement</li>
            <li>Shared approvals and receipts</li>
          </ul>
          {pairing ? (
            <div className="truth-note">
              <b>Pairing code: {pairing.code}</b>
              <p>Expires {new Date(pairing.expiresAt).toLocaleTimeString()}.</p>
            </div>
          ) : (
            <button onClick={createPairing}>Create pairing code</button>
          )}
        </div>
        <Nook3D
          compact
          name={appearance.name}
          primary={appearance.primary}
          secondary={appearance.secondary}
          faceGlow={appearance.glow}
          outfit={appearance.outfit}
          accessory={appearance.accessory}
          agentState="offline"
          message="Desktop runtime is not connected."
          draggable={false}
        />
      </div>
    </section>
  );
  const content =
    section === "home"
      ? room
      : section === "tasks"
        ? tasks
        : section === "memory"
          ? memory
          : section === "connectors"
            ? connectors
            : section === "wardrobe"
              ? wardrobe
              : section === "marketplace"
                ? marketplace
                : desktop;
  return (
    <main className="dashboard-shell">
      <aside className="dash-sidebar">
        <Link href="/" className="dash-brand">
          <span>›_</span>nook
        </Link>
        <div className="dash-pet-profile">
          <div className="profile-orb">›_</div>
          <div>
            <b>{appearance.name}</b>
            <span>
              <i /> Web room
            </span>
          </div>
        </div>
        <nav aria-label="Control room navigation">
          {sections.map((item) => (
            <Link
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              className={section === item.id ? "active" : ""}
              href={item.id === "home" ? "/dashboard" : `/dashboard/${item.id}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="dash-sidebar-bottom">
          <Link href="/create">Customize Nook</Link>
          <Link href="/">← Website</Link>
        </div>
      </aside>
      <div className="dash-main" data-section={heading.toLowerCase()}>
        {content}
      </div>
    </main>
  );
}

function PageHead({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <header className="dash-page-head">
      <div>
        <span className="dash-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </header>
  );
}
function Empty({ title, copy }: { title: string; copy?: string }) {
  return (
    <div className="honest-empty">
      <span className="surface-label live">LIVE STATE</span>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  );
}
