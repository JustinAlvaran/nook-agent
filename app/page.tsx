"use client";

import { FormEvent, useMemo, useState } from "react";

type Pet = {
  name: string; maker: string; price: number; rating: string; jobs: string;
  tone: "blue" | "coral" | "mint"; tag: string; specialty: string;
};

const pets: Pet[] = [
  { name: "Orbit", maker: "Nori Labs", price: 18, rating: "4.9", jobs: "12.4k", tone: "blue", tag: "Best for browsing", specialty: "Browser + forms" },
  { name: "Mochi", maker: "Jun Park", price: 24, rating: "4.8", jobs: "8.7k", tone: "coral", tag: "Creator favorite", specialty: "Content + social" },
  { name: "Byte", maker: "Ari.exe", price: 12, rating: "4.7", jobs: "6.1k", tone: "mint", tag: "Fast learner", specialty: "Files + research" },
];

const taskSteps = ["Opening facebook.com", "Reading the visible page", "Preparing your Page details", "Waiting for your approval"];

function PetAvatar({ tone = "blue", small = false }: { tone?: Pet["tone"]; small?: boolean }) {
  return <div className={`pet-avatar pet-${tone} ${small ? "pet-small" : ""}`} aria-hidden="true">
    <div className="pet-shadow"/><div className="pet-ear pet-ear-left"/><div className="pet-ear pet-ear-right"/>
    <div className="pet-head"><div className="pet-face"><span className="pet-eye pet-eye-left"/><span className="pet-eye pet-eye-right"/><span className="pet-mouth"/></div></div>
    <div className="pet-body"><span className="pet-core">›_</span></div><div className="pet-arm pet-arm-left"/><div className="pet-arm pet-arm-right"/>
    <div className="pet-foot pet-foot-left"/><div className="pet-foot pet-foot-right"/>
  </div>;
}

function Brand() {
  return <a className="brand" href="#top" aria-label="Nook home"><span className="brand-mark">›_</span><span>nook</span></a>;
}

export default function Home() {
  const [command, setCommand] = useState("Open Facebook and help me create a Page");
  const [runState, setRunState] = useState<"idle"|"running"|"approval"|"done">("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [filter, setFilter] = useState("Featured");
  const [cart, setCart] = useState<Pet | null>(null);
  const [modal, setModal] = useState<"access"|"creator"|null>(null);
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<"idle"|"saving"|"success"|"error">("idle");

  const filteredPets = useMemo(() => {
    if (filter === "Under $20") return pets.filter((pet) => pet.price < 20);
    if (filter === "Top rated") return [...pets].sort((a,b) => Number(b.rating)-Number(a.rating));
    return pets;
  }, [filter]);

  function runDemo() {
    if (!command.trim() || runState === "running") return;
    setRunState("running"); setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((step) => {
      if (step >= 2) { window.clearInterval(timer); setRunState("approval"); return 3; }
      return step + 1;
    }), 650);
  }

  function approveDemo() { setRunState("done"); window.setTimeout(() => setRunState("idle"), 2400); }

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!email.trim()) return; setFormState("saving");
    try {
      const response = await fetch("/api/early-access", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ email, interest: modal === "creator" ? "creator" : "buyer" }) });
      if (!response.ok) throw new Error(); setFormState("success");
    } catch { setFormState("error"); }
  }

  return <main id="top">
    <nav className="nav shell" aria-label="Main navigation">
      <Brand/><div className="nav-links"><a href="#how">How it works</a><a href="#marketplace">Marketplace</a><a href="#creators">For creators</a><a href="#pricing">Pricing</a></div>
      <a className="button button-small button-outline" href="/dashboard">Launch demo</a>
    </nav>

    <section className="hero shell">
      <div className="hero-copy">
        <div className="eyebrow"><span className="status-dot"/> Your desktop has a new best friend</div>
        <h1>Ask your pet.<br/><span>Watch it get done.</span></h1>
        <p className="hero-lede">A trainable desktop companion that walks across your screen, understands your apps, and turns plain-language requests into visible, approval-first actions.</p>
        <div className="hero-actions"><button className="button button-primary" onClick={() => setModal("access")}>Start with Nook <span>→</span></button><a className="button button-ghost" href="#how"><span className="play">▶</span> See how it works</a></div>
        <div className="hero-proof"><div className="avatar-stack"><span>J</span><span>A</span><span>M</span></div><div><strong>2,400+ early trainers</strong><small>building safer, friendlier automations</small></div></div>
      </div>

      <div className={`desktop-scene state-${runState}`}>
        <div className="window-bar"><div className="window-dots"><i/><i/><i/></div><span>nook.desktop</span><div className="window-signal"><i/> private session</div></div><div className="scene-grid"/>
        <div className="app-chip chip-one"><span>f</span> facebook.com</div><div className="app-chip chip-two"><span>⌘</span> Page setup</div>
        <div className="task-panel"><div className="task-heading"><span>Live task</span><em>{runState === "idle" ? "Ready" : runState === "done" ? "Complete" : "Working"}</em></div>{taskSteps.map((label,index) => <div className={`task-step ${index <= activeStep && runState !== "idle" ? "active" : ""}`} key={label}><span>{["↗","◎","✎","✓"][index]}</span><p>{label}</p></div>)}</div>
        <div className="pet-stage"><PetAvatar/></div>
        <div className="speech-bubble" aria-live="polite">{runState === "idle" && <>Ready when you are. <b>What should we do?</b></>}{runState === "running" && <>On it. I’ll only use what’s visible <b>and pause before changes.</b></>}{runState === "approval" && <>Everything is filled in. <b>Should I create the Page?</b></>}{runState === "done" && <>Done! Your Page setup is complete. <b>Nice teamwork.</b></>}</div>
        <div className="command-card"><label htmlFor="pet-command">Tell Nook what to do</label><div className="command-row"><span className="spark">✦</span><input id="pet-command" value={command} onChange={(e)=>setCommand(e.target.value)} onKeyDown={(e)=>e.key === "Enter" && runDemo()}/>{runState === "approval" ? <button className="approve-button" onClick={approveDemo}>Approve</button> : <button aria-label="Run command" onClick={runDemo}>↑</button>}</div><div className="quick-commands"><button onClick={()=>setCommand("Open my calendar and find a free hour")}>Find focus time</button><button onClick={()=>setCommand("Draft a Facebook Page for my new shop")}>Create a page</button><button onClick={()=>setCommand("Organize the files on my desktop")}>Tidy files</button></div></div>
      </div>
    </section>

    <section className="trust-strip shell" aria-label="Product principles"><span><i>✓</i> Visible actions</span><span><i>✓</i> Approval before posting</span><span><i>✓</i> Skills you can inspect</span><span><i>✓</i> Local-first memory</span></section>

    <section className="section shell" id="how">
      <div className="section-kicker">A companion, not another control panel</div><div className="section-heading split-heading"><h2>One sentence in.<br/><span>A finished task out.</span></h2><p>Nook watches only the window you share, narrates its next step, and asks before it posts, pays, sends, or publishes.</p></div>
      <div className="steps-grid"><article className="step-card"><div className="step-number">01</div><div className="mini-command"><span>✦</span><p>“Open my store dashboard and draft a launch post.”</p></div><h3>Ask naturally</h3><p>No macros to memorize. Speak, type, or drop in a repeatable recipe.</p></article><article className="step-card featured-step"><div className="step-number">02</div><div className="walk-track"><span className="walk-line"/><PetAvatar small/></div><h3>Watch it work</h3><p>Your pet moves between shared windows and explains each action in real time.</p></article><article className="step-card"><div className="step-number">03</div><div className="approval-card"><span>Ready to publish</span><div><i>Cancel</i><b>Approve</b></div></div><h3>Stay in control</h3><p>Sensitive actions stop at a clear checkpoint. You always make the final call.</p></article></div>
    </section>

    <section className="market-section" id="marketplace"><div className="shell">
      <div className="section-kicker">The companion marketplace</div><div className="section-heading market-heading"><div><h2>Find a pet with<br/><span>skills to match.</span></h2><p>Every companion includes an inspectable skill card, behavior profile, update history, and creator support.</p></div><div className="market-filters" role="group" aria-label="Filter pets">{["Featured","Top rated","Under $20"].map(item=><button className={filter===item?"active":""} key={item} onClick={()=>setFilter(item)}>{item}</button>)}</div></div>
      <div className="pet-grid">{filteredPets.map((pet)=><article className="pet-card" key={pet.name}><div className={`pet-card-visual visual-${pet.tone}`}><span className="pet-tag">{pet.tag}</span><PetAvatar tone={pet.tone}/><span className="float-skill skill-a">{pet.specialty.split(" + ")[0]}</span><span className="float-skill skill-b">{pet.specialty.split(" + ")[1]}</span></div><div className="pet-card-content"><div><h3>{pet.name}</h3><p>by {pet.maker}</p></div><strong>${pet.price}</strong></div><div className="pet-meta"><span>★ {pet.rating}</span><span>{pet.jobs} tasks</span><button onClick={()=>setCart(pet)}>Preview +</button></div></article>)}</div>
      <div className="market-footer"><a href="#pricing">Explore the launch collection <span>→</span></a><p><span>85%</span> of every pet sale goes to its creator.</p></div>
    </div></section>

    <section className="creator-section shell" id="creators"><div className="creator-panel">
      <div className="creator-copy"><div className="section-kicker">Build a personality. Build a business.</div><h2>Teach it once.<br/><span>Earn on repeat.</span></h2><p>Package your avatar, voice, safe behaviors, and workflow recipes into a companion people can trust—and buy.</p><ul><li><span>01</span><div><b>Shape the look</b><small>Import a GLB avatar or start from a rig-ready base.</small></div></li><li><span>02</span><div><b>Train visible behaviors</b><small>Record a workflow, add guardrails, and test every branch.</small></div></li><li><span>03</span><div><b>Publish your price</b><small>Sell once, bundle skill packs, or offer updates by subscription.</small></div></li></ul><button className="button button-primary button-coral" onClick={()=>setModal("creator")}>Open creator studio <span>→</span></button></div>
      <div className="studio-preview"><div className="studio-top"><span>Companion Studio</span><div><i/> Draft saved</div></div><div className="studio-body"><div className="studio-sidebar"><b>Appearance</b><span className="active">Character</span><span>Voice</span><span>Motion</span><b>Brain</b><span>Skills</span><span>Guardrails</span></div><div className="studio-canvas"><div className="canvas-orbit"/><PetAvatar tone="coral"/><div className="axis-floor"/></div><div className="studio-controls"><span>Personality</span><label>Energy <i><b style={{width:"72%"}}/></i></label><label>Curiosity <i><b style={{width:"88%"}}/></i></label><label>Chattiness <i><b style={{width:"42%"}}/></i></label><span>Guardrails</span><label className="toggle-row">Confirm social posts <b className="toggle on"/></label><label className="toggle-row">Confirm purchases <b className="toggle on"/></label></div></div><div className="studio-bottom"><span>Estimated creator earnings</span><strong>$14.45 <small>/ sale</small></strong><button>Publish test</button></div></div>
    </div></section>

    <section className="safety-section shell"><div className="safety-copy"><div className="section-kicker">Built for trust</div><h2>Helpful by nature.<br/><span>Bounded by design.</span></h2><p>Nook doesn’t pretend to be you. Every companion operates inside a permission envelope you can read, change, and revoke.</p></div><div className="safety-grid"><article><span className="safety-icon">◎</span><h3>Shared-window vision</h3><p>Your pet sees only the app window you intentionally share.</p></article><article><span className="safety-icon">◈</span><h3>Action receipts</h3><p>Review what happened, what changed, and which permission was used.</p></article><article><span className="safety-icon">⌁</span><h3>Official integrations</h3><p>Connect approved APIs for social, calendar, commerce, and productivity tools.</p></article><article><span className="safety-icon">✦</span><h3>Creator verification</h3><p>Skills are scanned, versioned, tested, and signed before listing.</p></article></div></section>

    <section className="pricing-section" id="pricing"><div className="shell pricing-shell"><div className="pricing-copy"><div className="section-kicker">Start small. Grow with your pet.</div><h2>Meet Nook for free.</h2><p>Try the companion, run starter skills, and add premium pets only when you find one you love.</p></div><div className="price-card free-card"><span>Starter</span><h3>$0<small> forever</small></h3><ul><li>1 default companion</li><li>10 assisted tasks / month</li><li>Browser + file starter skills</li><li>Approval checkpoints</li></ul><button className="button button-outline" onClick={()=>setModal("access")}>Join the beta</button></div><div className="price-card pro-card"><div className="popular">MOST POPULAR</div><span>Trainer</span><h3>$12<small> / month</small></h3><ul><li>Unlimited personal tasks</li><li>Advanced skill packs</li><li>Memory controls + task history</li><li>Marketplace discounts</li></ul><button className="button button-primary" onClick={()=>setModal("access")}>Reserve Trainer</button></div></div></section>

    <footer className="footer shell"><div><Brand/><p>Your helpful little layer for the desktop.</p></div><div className="footer-links"><div><b>Product</b><a href="#how">How it works</a><a href="#marketplace">Marketplace</a><a href="#pricing">Pricing</a></div><div><b>Creators</b><a href="#creators">Studio</a><a href="#creators">Revenue share</a><a href="#creators">Safety guide</a></div><div><b>Company</b><a href="#top">About</a><a href="#top">Privacy</a><a href="#top">Terms</a></div></div><div className="footer-bottom"><span>© 2026 Nook Labs. Concept preview.</span><span>Built for curious humans <i>♥</i></span></div></footer>

    {cart && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setCart(null)}><div className="modal pet-modal" role="dialog" aria-modal="true" aria-labelledby="pet-modal-title" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={()=>setCart(null)}>×</button><div className={`modal-pet visual-${cart.tone}`}><PetAvatar tone={cart.tone}/></div><div className="modal-content"><span className="section-kicker">Companion preview</span><h2 id="pet-modal-title">Meet {cart.name}.</h2><p>{cart.name} comes with 8 verified skills, an inspectable action policy, and free updates from {cart.maker}.</p><div className="modal-stats"><span><b>{cart.rating}</b> rating</span><span><b>{cart.jobs}</b> tasks</span><span><b>8</b> skills</span></div><button className="button button-primary" onClick={()=>{setCart(null);setModal("access")}}>Reserve for ${cart.price}</button><small>No charge today. We’ll invite you when the marketplace opens.</small></div></div></div>}

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setModal(null)}><div className="modal access-modal" role="dialog" aria-modal="true" aria-labelledby="access-title" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={()=>setModal(null)}>×</button><div className="access-pet"><PetAvatar tone={modal === "creator" ? "coral":"blue"} small/></div>{formState === "success" ? <div className="success-state"><span>✓</span><h2>You’re on the list.</h2><p>Nook will send one thoughtful update when your spot is ready.</p><button className="button button-primary" onClick={()=>{setModal(null);setFormState("idle");setEmail("")}}>Done</button></div> : <><span className="section-kicker">{modal === "creator" ? "Creator early access":"Private beta"}</span><h2 id="access-title">{modal === "creator" ? "Build the next favorite pet.":"Bring Nook home."}</h2><p>{modal === "creator" ? "Get the studio preview, avatar specification, and founding-creator revenue terms.":"Join the first group training Nook on useful, safe, everyday desktop tasks."}</p><form onSubmit={submitAccess}><label htmlFor="access-email">Email address</label><div className="email-row"><input id="access-email" type="email" required placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="button button-primary" disabled={formState === "saving"}>{formState === "saving" ? "Saving…":"Join beta"}</button></div>{formState === "error" && <span className="form-error">We couldn’t save that yet. Please try again.</span>}</form><small>One launch update. No spam. Unsubscribe anytime.</small></>}</div></div>}
  </main>;
}
