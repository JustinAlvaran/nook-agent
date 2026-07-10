"use client";

import { useState } from "react";

const navItems = ["Home", "Tasks", "Skills", "Marketplace", "Permissions", "Creator"];
const taskLog = [
  { title: "Prepared Facebook Page details", time: "Today, 9:42 AM", status: "Awaiting approval", app: "f" },
  { title: "Organized 18 download files", time: "Yesterday, 4:18 PM", status: "Completed", app: "⌁" },
  { title: "Found a 60-minute focus block", time: "Yesterday, 10:06 AM", status: "Completed", app: "□" },
  { title: "Drafted three launch captions", time: "Mon, 2:31 PM", status: "Draft saved", app: "✎" },
];
const skillCards = [
  { name: "Browser Guide", desc: "Navigate shared tabs, explain forms, and prepare entries.", scope: "Shared tab only", color: "blue" },
  { name: "File Tidy", desc: "Rename, sort, and group files using rules you approve.", scope: "Chosen folders", color: "mint" },
  { name: "Social Drafts", desc: "Prepare Page posts through approved integrations.", scope: "Drafts only", color: "coral" },
];
const marketPets = [
  { name: "Mochi", maker: "Jun Park", price: "$24", color: "coral", job: "Content + social" },
  { name: "Byte", maker: "Ari.exe", price: "$12", color: "mint", job: "Files + research" },
  { name: "Luma", maker: "Soft Circuit", price: "$16", color: "violet", job: "Calendar + focus" },
];

function MiniPet({ color = "blue" }: { color?: string }) {
  return <div className={`dash-pet dash-pet-${color}`} aria-hidden="true"><div className="dash-pet-shadow"/><div className="dash-pet-ear left"/><div className="dash-pet-ear right"/><div className="dash-pet-head"><div className="dash-pet-screen"><i/><i/><b/></div></div><div className="dash-pet-body"><span>›_</span></div><div className="dash-pet-foot left"/><div className="dash-pet-foot right"/></div>;
}

export default function Dashboard() {
  const [active, setActive] = useState("Home");
  const [command, setCommand] = useState("Help me finish setting up my Facebook Page");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Ready for a new task");
  const [installed, setInstalled] = useState<string[]>(["Browser Guide", "File Tidy"]);
  const [permissions, setPermissions] = useState({ sharedWindow: true, files: true, social: false, purchases: false });

  function runCommand() {
    if (!command.trim() || running) return;
    setRunning(true); setMessage("Reading the shared window…");
    window.setTimeout(() => setMessage("Preparing a safe action preview…"), 850);
    window.setTimeout(() => { setMessage("Ready for your approval"); setRunning(false); }, 1750);
  }

  function toggleInstall(name: string) {
    setInstalled((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
  }

  const content = active === "Home" ? <>
    <header className="dash-header"><div><span className="dash-eyebrow">Friday, July 10</span><h1>Good afternoon, Trainer.</h1><p>Orbit is awake, updated, and ready to help.</p></div><div className="dash-header-actions"><button aria-label="Notifications">◌</button><div className="dash-profile">KG</div></div></header>
    <section className="dash-hero-card"><div className="dash-orbit"><span/><span/><span/></div><div className={`dash-pet-wrap ${running ? "working" : ""}`}><MiniPet/></div><div className="dash-hero-copy"><div className="dash-status"><i/> ORBIT · ONLINE</div><h2>What should we do<br/>together?</h2><p>Nook will explain each step and pause before anything important.</p></div><div className="dash-command"><label htmlFor="dashboard-command">Ask Orbit</label><div><span>✦</span><input id="dashboard-command" value={command} onChange={(e)=>setCommand(e.target.value)} onKeyDown={(e)=>e.key === "Enter" && runCommand()}/><button onClick={runCommand} aria-label="Run command">↑</button></div><small aria-live="polite">{message}</small></div></section>
    <div className="dash-grid"><section className="dash-panel dash-activity"><div className="dash-panel-title"><div><h3>Recent activity</h3><p>Everything Orbit has prepared or completed.</p></div><button onClick={()=>setActive("Tasks")}>View all →</button></div>{taskLog.slice(0,3).map((task)=><article key={task.title}><span className="task-app">{task.app}</span><div><b>{task.title}</b><small>{task.time}</small></div><em className={task.status === "Completed" ? "complete" : "pending"}>{task.status}</em></article>)}</section><aside className="dash-panel dash-permission-card"><div className="dash-panel-title"><div><h3>Permission pulse</h3><p>Orbit’s current access.</p></div></div><div className="permission-ring"><div><strong>2</strong><small>active</small></div></div><ul><li><i className="on"/> Shared browser tab</li><li><i className="on"/> Chosen folders</li><li><i/> Posting & publishing</li><li><i/> Purchases</li></ul><button onClick={()=>setActive("Permissions")}>Review permissions</button></aside></div>
  </> : active === "Tasks" ? <section className="dash-page"><div className="dash-page-head"><div><span className="dash-eyebrow">Receipts, drafts, and checkpoints</span><h1>Task history</h1><p>See what your companion touched and what still needs you.</p></div><button className="dash-primary" onClick={()=>setActive("Home")}>+ New task</button></div><div className="task-table"><div className="task-table-head"><span>Task</span><span>Status</span><span>When</span><span>Receipt</span></div>{taskLog.map((task)=><div className="task-table-row" key={task.title}><span><i>{task.app}</i><b>{task.title}</b></span><em className={task.status === "Completed" ? "complete" : "pending"}>{task.status}</em><small>{task.time}</small><button>View →</button></div>)}</div></section>
  : active === "Skills" ? <section className="dash-page"><div className="dash-page-head"><div><span className="dash-eyebrow">Inspect before you install</span><h1>Orbit’s skills</h1><p>Every skill declares exactly what it can see and do.</p></div><button className="dash-primary" onClick={()=>setActive("Marketplace")}>Browse skills</button></div><div className="skill-grid">{skillCards.map((skill)=><article className={`skill-card skill-${skill.color}`} key={skill.name}><div className="skill-icon">{skill.name === "Browser Guide" ? "↗" : skill.name === "File Tidy" ? "⌁" : "✎"}</div><span className="skill-badge">{installed.includes(skill.name) ? "Installed" : "Available"}</span><h3>{skill.name}</h3><p>{skill.desc}</p><div><span>Access scope</span><b>{skill.scope}</b></div><button onClick={()=>toggleInstall(skill.name)}>{installed.includes(skill.name) ? "Remove skill" : "Install skill"}</button></article>)}</div></section>
  : active === "Marketplace" ? <section className="dash-page"><div className="dash-page-head"><div><span className="dash-eyebrow">Reviewed companions and skills</span><h1>Marketplace</h1><p>Adopt a new personality or add a focused capability.</p></div><div className="dash-search">⌕ <input aria-label="Search marketplace" placeholder="Search pets or skills"/></div></div><div className="market-mini-grid">{marketPets.map((pet)=><article key={pet.name}><div className={`market-mini-visual visual-${pet.color}`}><MiniPet color={pet.color}/><span>{pet.job}</span></div><div className="market-mini-copy"><div><h3>{pet.name}</h3><p>by {pet.maker} · ★ 4.8</p></div><b>{pet.price}</b></div><button onClick={()=>setMessage(`${pet.name} added to your wishlist`)}>Preview companion</button></article>)}</div></section>
  : active === "Permissions" ? <section className="dash-page"><div className="dash-page-head"><div><span className="dash-eyebrow">You decide the boundary</span><h1>Permissions</h1><p>Change or revoke access at any time. Sensitive actions always ask again.</p></div><span className="safety-score">Safety score <b>Strong</b></span></div><div className="permission-list">{([
    ["sharedWindow","Shared browser window","Read and interact only with the tab you explicitly share.","Recommended"],
    ["files","Chosen folders","Organize files only inside folders you select.","On for File Tidy"],
    ["social","Posting and publishing","Allow approved integrations to publish after confirmation.","Always confirms"],
    ["purchases","Purchases and payments","Prepare a checkout, but never submit payment automatically.","Always confirms"],
  ] as const).map(([key,title,desc,note])=><article key={key}><div className="permission-symbol">{key === "sharedWindow" ? "◎" : key === "files" ? "⌁" : key === "social" ? "✎" : "$"}</div><div><h3>{title}</h3><p>{desc}</p><small>{note}</small></div><button className={`dash-toggle ${permissions[key] ? "on" : ""}`} aria-pressed={permissions[key]} aria-label={`Toggle ${title}`} onClick={()=>setPermissions((state)=>({...state,[key]:!state[key]}))}><i/></button></article>)}</div></section>
  : <section className="dash-page"><div className="dash-page-head"><div><span className="dash-eyebrow">Teach it once. Earn on repeat.</span><h1>Creator studio</h1><p>Package a rig-ready avatar, behavior profile, and reviewed skills.</p></div><span className="draft-pill"><i/> Draft saved</span></div><div className="creator-workspace"><div className="creator-preview"><div className="creator-stage"><span className="stage-ring"/><MiniPet color="coral"/></div><div className="creator-avatar-name"><div><span>COMPANION NAME</span><h3>Mochi</h3></div><button>Change avatar</button></div></div><div className="creator-form"><div><span>Personality</span><label>Energy <input type="range" defaultValue="72"/></label><label>Curiosity <input type="range" defaultValue="88"/></label><label>Chattiness <input type="range" defaultValue="42"/></label></div><div><span>Publishing</span><label>Price <input className="price-input" defaultValue="$24"/></label><label>Creator share <b>85% · $20.40 per sale</b></label></div><button className="dash-primary">Run safety test</button><button className="dash-secondary">Preview listing</button></div></div></section>;

  return <main className="dashboard-shell"><aside className="dash-sidebar"><a href="/" className="dash-brand"><span>›_</span>nook</a><div className="dash-pet-profile"><MiniPet/><div><b>Orbit</b><span><i/> Online</span></div><button aria-label="Companion settings">•••</button></div><nav aria-label="Dashboard navigation">{navItems.map((item)=><button key={item} className={active === item ? "active" : ""} onClick={()=>setActive(item)}><span>{item === "Home" ? "⌂" : item === "Tasks" ? "✓" : item === "Skills" ? "✦" : item === "Marketplace" ? "◇" : item === "Permissions" ? "◉" : "⌘"}</span>{item}</button>)}</nav><div className="dash-sidebar-bottom"><button><span>?</span> Help center</button><a href="/">← Back to website</a></div></aside><div className="dash-main">{content}</div></main>;
}
