"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LazyNook3D as Nook3D } from "../components/LazyNook3D";
import type { NookAccessory, NookAgentState, NookOutfit } from "../components/Nook3D";

type PlanStep = { id:string; title:string; detail:string; kind:string; requiresApproval:boolean };
type LivePlan = {
  summary:string; userMessage:string; riskClass:0|1|2|3; requiresApproval:boolean;
  blocked:boolean; blockedReason:string; steps:PlanStep[];
};
type TaskRecord = { id:string; input:string; status:string; createdAt?:string; plan?:LivePlan|null };
type LiveApproval = { id:string; action_hash:string; risk_class:number; expires_at:string; intent?:{destinationLabel?:string;preview?:string} };
type ConnectorState = { configured:boolean; connection:null|{account_email:string;scopes:string[];status:string;last_used_at?:string} };
type CatalogItem = { listing_id:string; name:string; description:string; kind:string; price_amount:number; currency:string; preview_asset_url?:string|null };

const sections = [
  { id:"home", label:"Room", icon:"⌂" },
  { id:"tasks", label:"Tasks", icon:"✓" },
  { id:"connectors", label:"Connectors", icon:"↗" },
  { id:"wardrobe", label:"Wardrobe", icon:"◇" },
  { id:"marketplace", label:"Marketplace", icon:"+" },
  { id:"desktop", label:"Desktop", icon:"▣" },
] as const;

const starterItems = [
  { name:"Midnight hoodie", type:"Top", status:"Owned", className:"hoodie" },
  { name:"Star pin", type:"Accessory", status:"Owned", className:"star" },
  { name:"Cloud varsity", type:"Top", status:"Owned", className:"varsity" },
];

const previewListings = [
  { name:"Mochi", maker:"Jun Park", kind:"Character pack", note:"Content and social working style" },
  { name:"File Tidy", maker:"Nook Labs", kind:"Skill preview", note:"Proposed access: chosen folders" },
  { name:"Focus cap", maker:"Soft Circuit", kind:"Cosmetic preview", note:"Visual item only" },
];

function stateMessage(state:NookAgentState, name:string) {
  if (state === "planning") return "I’m turning that into a supervised plan.";
  if (state === "needs_approval") return "The plan needs your decision before any external effect.";
  if (state === "blocked") return "I stopped this request at the safety boundary.";
  if (state === "failed") return "Planning did not finish. Nothing external changed.";
  if (state === "completed") return "The plan is ready. No external action has happened.";
  if (state === "offline") return "Desktop companion is not paired yet.";
  return `I’m ready when you are, ${name}.`;
}

function workerLabel(step:PlanStep) {
  if (step.kind === "research") return "Research worker";
  if (step.kind === "draft") return "Draft worker";
  if (step.kind === "open_link") return "Browser guide";
  if (step.kind === "external_effect") return "Connector worker";
  return "Nook planner";
}

export default function DashboardClient() {
  const pathname = usePathname();
  const routeSection = pathname.split("/")[2] || "home";
  const section = sections.some((item)=>item.id===routeSection) ? routeSection : "home";
  const [command,setCommand] = useState("");
  const [agentState,setAgentState] = useState<NookAgentState>("ready");
  const [status,setStatus] = useState("Ready for a new task");
  const [livePlan,setLivePlan] = useState<LivePlan|null>(null);
  const [history,setHistory] = useState<TaskRecord[]|null>(null);
  const [historyNotice,setHistoryNotice] = useState("Loading real task history…");
  const [activeTaskId,setActiveTaskId] = useState<string|null>(null);
  const [activeApproval,setActiveApproval] = useState<LiveApproval|null>(null);
  const [decisionBusy,setDecisionBusy] = useState(false);
  const [connector,setConnector] = useState<ConnectorState|null>(null);
  const [catalog,setCatalog] = useState<CatalogItem[]|null>(null);
  const [claimedListings,setClaimedListings] = useState<string[]>([]);
  const [pairing,setPairing] = useState<{code:string;expiresAt:string}|null>(null);
  const [appearance,setAppearance] = useState({name:"Orbit",primary:"#617fff",secondary:"#9db0ff",glow:"#7debff",outfit:"hoodie" as NookOutfit,accessory:"star" as NookAccessory});

  useEffect(()=>{
    const saved=window.localStorage.getItem("nook-creator-draft");
    if(!saved)return;
    const frame=window.requestAnimationFrame(()=>{try{const draft=JSON.parse(saved);setAppearance({name:draft.name||"Orbit",primary:draft.color?.primary||"#617fff",secondary:draft.color?.secondary||"#9db0ff",glow:draft.color?.glow||"#7debff",outfit:draft.outfit||"hoodie",accessory:draft.accessory||"star"})}catch{/* device draft is optional */}});
    return()=>window.cancelAnimationFrame(frame);
  },[]);

  useEffect(()=>{
    if(section!=="connectors" || connector)return;
    void fetch("/api/integrations/google").then(async(response)=>{
      const result=await response.json() as ConnectorState;
      setConnector(response.ok?result:{configured:false,connection:null});
    }).catch(()=>setConnector({configured:false,connection:null}));
  },[section,connector]);

  useEffect(()=>{
    if(section!=="marketplace" || catalog)return;
    void fetch("/api/marketplace/catalog").then(async(response)=>{
      const result=await response.json() as {items?:CatalogItem[]};
      setCatalog(response.ok?result.items||[]:[]);
    }).catch(()=>setCatalog([]));
  },[section,catalog]);

  useEffect(()=>{
    let cancelled=false;
    void fetch("/api/tasks").then(async(response)=>{
      const result=await response.json() as {tasks?:TaskRecord[];error?:string};
      if(cancelled)return;
      if(!response.ok){setHistory([]);setHistoryNotice(result.error||"Task history is unavailable.");return;}
      setHistory(result.tasks||[]);setHistoryNotice("");
    }).catch(()=>{if(!cancelled){setHistory([]);setHistoryNotice("Task history is temporarily unavailable.");}});
    return()=>{cancelled=true;};
  },[]);

  async function runCommand() {
    if(!command.trim() || agentState==="planning") return;
    setAgentState("planning"); setLivePlan(null); setStatus("Creating a durable, supervised plan…");
    try {
      const response=await fetch("/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({input:command,nookName:appearance.name})});
      if(response.status===401){window.location.href=`/auth/sign-in?next=${encodeURIComponent("/dashboard")}`;return;}
      const result=await response.json() as {error?:string;task?:{id:string;input:string;status:string;plan:LivePlan;persisted:boolean;approval?:LiveApproval|null}};
      if(!response.ok || !result.task) throw new Error(result.error||"Nook could not prepare a plan.");
      setLivePlan(result.task.plan);
      setActiveTaskId(result.task.id);
      setActiveApproval(result.task.approval||null);
      setAgentState(result.task.plan.blocked?"blocked":result.task.plan.requiresApproval?"needs_approval":"completed");
      setStatus(result.task.persisted?"Plan saved to task history":"Plan ready, but durable history is temporarily unavailable");
      if(result.task.persisted)setHistory((items)=>[{id:result.task!.id,input:result.task!.input,status:result.task!.status,plan:result.task!.plan},...(items||[])].filter((item,index,array)=>array.findIndex((candidate)=>candidate.id===item.id)===index));
    } catch(error) {
      setAgentState("failed"); setStatus(error instanceof Error?error.message:"Planning did not finish.");
    }
  }

  async function decideApproval(decision:"approve"|"reject") {
    if(!activeTaskId||!activeApproval||decisionBusy)return;
    setDecisionBusy(true);setStatus(`${decision==="approve"?"Approving":"Rejecting"} the exact simulator action…`);
    try{
      const response=await fetch(`/api/tasks/${activeTaskId}/approvals/${activeApproval.id}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({decision,actionHash:activeApproval.action_hash})});
      const result=await response.json() as {error?:string};
      if(response.status===428){window.location.href=`/auth/sign-in?next=${encodeURIComponent("/dashboard")}`;return;}
      if(!response.ok)throw new Error(result.error||"The decision could not be recorded.");
      setAgentState(decision==="approve"?"completed":"blocked");
      setStatus(decision==="approve"?"Approved once. A simulated receipt was recorded; no connector ran.":"Rejected. The task stopped without an external effect.");
      setActiveApproval(null);
      setHistory((items)=>(items||[]).map((task)=>task.id===activeTaskId?{...task,status:decision==="approve"?"completed":"blocked"}:task));
    }catch(error){setStatus(error instanceof Error?error.message:"The decision could not be recorded.");}
    finally{setDecisionBusy(false);}
  }

  async function createPairing() {
    const response=await fetch("/api/desktop/pairings",{method:"POST"});
    const result=await response.json() as {code?:string;expiresAt?:string;error?:string};
    if(!response.ok||!result.code||!result.expiresAt){setStatus(result.error||"Pairing is unavailable.");return;}
    setPairing({code:result.code,expiresAt:result.expiresAt});
  }

  async function claimListing(listingId:string) {
    const response=await fetch("/api/marketplace/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId})});
    const result=await response.json() as {claimed?:boolean;checkoutUrl?:string;error?:string};
    if(response.status===401){window.location.assign(`/auth/sign-in?next=${encodeURIComponent("/dashboard/marketplace")}`);return;}
    if(!response.ok){setStatus(result.error||"The catalog item could not be added.");return;}
    if(result.checkoutUrl){window.location.assign(result.checkoutUrl);return;}
    setClaimedListings((items)=>[...new Set([...items,listingId])]);
    setStatus("Added to your durable Nook inventory.");
  }

  const currentMessage=stateMessage(agentState,appearance.name);
  const heading = useMemo(()=>sections.find((item)=>item.id===section)?.label||"Room",[section]);

  const room = <>
    <header className="dash-header truthful-head"><div><span className="dash-eyebrow">NOOK CONTROL ROOM · LIVE PLANNING</span><h1>{appearance.name} is ready to plan with you.</h1><p>Plans are live. Connector execution and approvals are clearly marked until enabled.</p></div><div className="dash-header-actions"><Link className="dash-closet-link" href="/dashboard/wardrobe">Wardrobe</Link><div className="dash-profile" aria-label="Signed-in account">KG</div></div></header>
    <section className="control-room-card">
      <div className="room-presence"><span className={`truth-status status-${agentState}`}><i/>{agentState.replaceAll("_"," ")}</span><Nook3D compact name={appearance.name} primary={appearance.primary} secondary={appearance.secondary} faceGlow={appearance.glow} outfit={appearance.outfit} accessory={appearance.accessory} agentState={agentState} message={currentMessage}/><p>The web room plans and records tasks. Screen-wide movement requires the future signed desktop app.</p></div>
      <div className="room-composer"><label htmlFor="nook-command">What should {appearance.name} help you do?</label><textarea id="nook-command" value={command} onChange={(event)=>setCommand(event.target.value)} placeholder="Example: Draft a launch checklist for my new shop" maxLength={1200}/><div><small>{command.length}/1200 · Nook shows the plan before any effect</small><button onClick={runCommand} disabled={!command.trim()||agentState==="planning"}>{agentState==="planning"?"Planning…":"Create plan →"}</button></div><p role="status" aria-live="polite">{status}</p></div>
    </section>
    {livePlan ? <section className={`task-drawer ${livePlan.blocked?"is-blocked":""}`} aria-live="polite">
      <header><div><span className="surface-label live">LIVE PLAN</span><h2>{livePlan.summary}</h2><p>{livePlan.blocked?livePlan.blockedReason:livePlan.userMessage}</p></div><em>Risk {livePlan.riskClass} · {livePlan.requiresApproval?"Approval checkpoint":"Read-only plan"}</em></header>
      {!livePlan.blocked&&<div className="worker-track">{livePlan.steps.map((step,index)=><article key={step.id}><span>{index+1}</span><div><b>{step.title}</b><small>{step.detail}</small><i>{workerLabel(step)} · {step.requiresApproval?"Stops for you":"Prepared only"}</i></div></article>)}</div>}
      {livePlan.requiresApproval&&!livePlan.blocked&&<section className="approval-ticket"><div><span className={`surface-label ${activeApproval?"live":"preview"}`}>{activeApproval?"LIVE SIMULATOR APPROVAL":"APPROVAL PREVIEW"}</span><h3>{activeApproval?.intent?.destinationLabel||"External execution is not connected yet"}</h3><p>{activeApproval?.intent?.preview||"A live connector ticket will name the destination account, exact data sent, reversibility, and expiration."}</p>{activeApproval&&<small>Expires {new Date(activeApproval.expires_at).toLocaleString()} · action arguments are hash-bound</small>}</div><button disabled={!activeApproval||decisionBusy} onClick={()=>decideApproval("reject")}>Reject</button><button disabled={!activeApproval||decisionBusy} onClick={()=>decideApproval("approve")}>Approve once</button></section>}
      <footer className="plan-receipt"><div><span className="surface-label live">VERIFIED RECEIPT</span><b>Plan prepared</b><small>No connector ran and no external action was attempted.</small></div><time>Current session</time></footer>
    </section> : <section className="honest-empty"><span className="surface-label live">LIVE</span><h2>No task is active.</h2><p>Ask Nook for a plan. Your first real task will appear here instead of sample activity.</p></section>}
  </>;

  const tasks = <section className="dash-page"><PageHead eyebrow="Durable plans and receipts" title="Tasks" copy="Only real account activity belongs here."/>{history===null?<div className="honest-empty"><span className="surface-label live">LIVE</span><h2>Loading your task history…</h2></div>:history.length?<div className="task-table truthful-task-table"><div className="task-table-head"><span>Request</span><span>Status</span><span>When</span><span>Receipt</span></div>{history.map((task)=><article className="task-table-row" key={task.id}><span><i>✓</i><b>{task.input}</b></span><em className={task.status==="ready"?"complete":"pending"}>{task.status.replaceAll("_"," ")}</em><small>{task.createdAt?new Date(task.createdAt).toLocaleString():"Current session"}</small><span className="receipt-state">{task.plan?"Plan recorded":"Record only"}</span></article>)}</div>:<div className="honest-empty"><span className="surface-label live">LIVE EMPTY STATE</span><h2>No saved task history to show.</h2><p>{historyNotice||"Create a plan in the room. Confirmed history will appear here."}</p><Link className="dash-primary link-button" href="/dashboard">Create a plan</Link></div>}</section>;

  const connectors = <section className="dash-page"><PageHead eyebrow="Google Workspace first" title="Connectors" copy="Login accounts and connected services stay separate."/><div className="connector-grid"><article><div className="connector-mark google">G</div><span className={`surface-label ${connector?.connection?"live":"preview"}`}>{connector?.connection?"CONNECTED":connector?.configured?"READY TO CONNECT":"OWNER SETUP REQUIRED"}</span><h2>Google Workspace</h2><p>{connector?.connection?`${connector.connection.account_email} · ${connector.connection.status}`:"Drive, Docs, Gmail drafts, and Calendar availability use incremental permissions."}</p><ul><li>Account and granted scopes are visible</li><li>Writes and sends stop for approval</li><li>Tokens never appear in Nook chat</li></ul>{connector?.connection?<button onClick={async()=>{await fetch("/api/integrations/google",{method:"DELETE"});setConnector(null);}}>Revoke connection</button>:connector?.configured?<a className="dash-primary link-button" href="/api/integrations/google/connect?capability=read">Connect read-only Google</a>:<button disabled>Dedicated OAuth client required</button>}</article><article className="connector-future"><span className="surface-label later">COMING LATER</span><h2>More connectors</h2><p>Facebook Pages follows after the Google Workspace task loop is verified.</p></article></div></section>;

  const wardrobe = <section className="dash-page"><PageHead eyebrow="Cosmetics are cosmetic" title="Wardrobe" copy="Starter items shown here are part of the current Nook creator preview." action={<Link className="dash-primary link-button" href="/create">Customize Nook</Link>}/><div className="wardrobe-owned">{starterItems.map((item)=><article key={item.name}><div className={`wardrobe-thumb ${item.className}`}/><span className="surface-label preview">STARTER PREVIEW</span><h3>{item.name}</h3><p>{item.type} · {item.status}</p></article>)}</div><div className="truth-note"><b>Ownership foundation</b><p>Database-backed inventory, saved outfits, and cross-device equipping are not live yet. The creator currently saves a device draft and account appearance when available.</p></div></section>;

  const marketplaceItems=catalog?.length?catalog.map((item)=>({name:item.name,maker:"Nook Labs",kind:item.kind,note:item.description,listingId:item.listing_id,price:item.price_amount===0?"Free":`${item.currency} ${(item.price_amount/100).toFixed(2)}`})):previewListings.map((item)=>({...item,listingId:"",price:"Preview"}));
  const marketplace = <section className="dash-page"><PageHead eyebrow="Curated platform catalog" title="Marketplace preview" copy="Free platform items use durable entitlements. Paid checkout remains disabled until verified payment secrets are configured."/><div className="preview-market">{marketplaceItems.map((item)=><article key={item.name}><span className={`surface-label ${catalog?.length?"live":"preview"}`}>{catalog?.length?"LIVE CATALOG":"CONCEPT LISTING"}</span><div className="listing-art">&gt;_</div><h3>{item.name}</h3><b>by {item.maker} · {item.price}</b><p>{item.kind} · {item.note}</p><button disabled={!item.listingId||claimedListings.includes(item.listingId)} onClick={()=>item.listingId&&claimListing(item.listingId)}>{claimedListings.includes(item.listingId)?"Added to inventory":item.listingId?item.price==="Free"?"Add free item":"Open test checkout":"Preview only"}</button></article>)}</div><div className="truth-note"><b>Marketplace release gate</b><p>Paid checkout becomes live only after signed webhooks, refunds, and idempotent entitlements pass verification.</p></div></section>;

  const desktop = <section className="dash-page"><PageHead eyebrow="Windows-first foundation" title="Desktop companion" copy="The signed Tauri runtime redeems a one-time code from this control room."/><div className="desktop-preview"><div><span className="surface-label preview">PAIRING FOUNDATION</span><h2>Bring {appearance.name} to your screen</h2><p>The desktop companion mirrors durable state and provides pause, hide, mute, and emergency-stop controls.</p><ul><li>One-time, ten-minute pairing code</li><li>Visible local capability indicators</li><li>Multi-monitor-safe movement</li><li>Shared approval receipts</li></ul>{pairing?<div className="truth-note"><b>Pairing code: {pairing.code}</b><p>Expires {new Date(pairing.expiresAt).toLocaleTimeString()}. Enter it only in Nook Desktop.</p></div>:<button onClick={createPairing}>Create pairing code</button>}</div><Nook3D compact name={appearance.name} primary={appearance.primary} secondary={appearance.secondary} faceGlow={appearance.glow} outfit={appearance.outfit} accessory={appearance.accessory} agentState="offline" message={pairing?"I am ready to pair.":"Desktop runtime is not connected."} draggable={false}/></div></section>;

  const content = section==="home"?room:section==="tasks"?tasks:section==="connectors"?connectors:section==="wardrobe"?wardrobe:section==="marketplace"?marketplace:desktop;

  return <main className="dashboard-shell"><aside className="dash-sidebar"><Link href="/" className="dash-brand"><span>›_</span>nook</Link><div className="dash-pet-profile"><div className="profile-orb">›_</div><div><b>{appearance.name}</b><span><i/> Web room</span></div></div><nav aria-label="Control room navigation">{sections.map((item)=><Link key={item.id} aria-current={section===item.id?"page":undefined} className={section===item.id?"active":""} href={item.id==="home"?"/dashboard":`/dashboard/${item.id}`}><span>{item.icon}</span>{item.label}</Link>)}</nav><div className="dash-sidebar-bottom"><Link href="/create">Customize Nook</Link><Link href="/">← Website</Link></div></aside><div className="dash-main" data-section={heading.toLowerCase()}>{content}</div></main>;
}

function PageHead({eyebrow,title,copy,action}:{eyebrow:string;title:string;copy:string;action?:React.ReactNode}) {
  return <header className="dash-page-head"><div><span className="dash-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}
