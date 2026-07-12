"use client";

/* Landing-page anchors intentionally use native navigation for auth and product entry points. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from "react";
import { LazyNook3D as Nook3D } from "./components/LazyNook3D";
import type { NookMotion } from "./components/Nook3D";

const taskSteps = [
  { title:"Prepare a Facebook Page setup worksheet", detail:"Lists missing business details and a user-led checklist. No Facebook access.", risk:"Local" },
];

const nookTypes = [
  { name:"Orbit", color:"#617fff", pale:"#9db0ff", job:"Calm starter look", note:"A hoodie, star pin, and balanced working-style preset." },
  { name:"Mochi", color:"#ff825f", pale:"#ffb49e", job:"Expressive starter look", note:"A varsity outfit, focus cap, and proactive preset." },
  { name:"Pip", color:"#47cfa9", pale:"#a2ead8", job:"Quiet starter look", note:"A utility vest, antenna, and low-initiative preset." },
];

export default function Home() {
  const [demoStep,setDemoStep]=useState(-1);
  const [motion,setMotion]=useState<NookMotion>("wave");
  const [approved,setApproved]=useState(false);

  function runDemo(){setApproved(false);setDemoStep(0);setMotion("think");window.setTimeout(()=>{setApproved(true);setMotion("success")},1100);window.setTimeout(()=>{setDemoStep(-1);setMotion("idle")},3200)}

  return <main className="trend-shell">
    <nav className="trend-nav"><a className="trend-brand" href="#top"><span>›_</span>nook</a><div><a href="#task">How it works</a><a href="#nooks">Meet the Nooks</a><a href="/create">Wardrobe</a><a href="#safety">Safety</a><a href="#build">For creators</a></div><div className="trend-nav-actions"><a href="/auth/sign-in?next=/dashboard">Sign in</a><a className="trend-primary small" href="/create">Create my Nook</a></div></nav>

    <section className="trend-hero" id="top"><div className="trend-hero-copy"><span className="trend-kicker"><i/> A companion you can see, teach, and trust</span><h1>Meet the little agent who starts in your control room.</h1><p>Give Nook a task. They show one allowlisted plan, pause for exact approval when needed, verify the result, and save a receipt.</p><div className="trend-actions"><a className="trend-primary" href="/create">Create my Nook <span>→</span></a><button onClick={runDemo}>Watch a supervised task <span>▶</span></button></div><div className="trend-proof"><span><b>Visible</b> task plans</span><span><b>Exact</b> approvals</span><span><b>Verified</b> receipts</span></div></div>
      <div className="trend-room"><div className="trend-room-grid"/><div className="trend-room-window"><i/><i/></div><div className="trend-room-shelf"><i/><i/><i/></div><Nook3D name="Orbit" motion={motion} message={demoStep===2?"The draft is ready. You choose what happens next.":demoStep>=0?"I’m preparing a safe preview.":"Want to make something useful together?"}/><div className="trend-room-status"><i/><span><b>Orbit is here</b><small>Web control room · private preview</small></span></div></div>
    </section>

    <section className="trend-task" id="task"><div className="trend-section-heading"><span className="trend-kicker">ONE BELIEVABLE TASK</span><h2>Ask once. See the exact boundary.</h2><p>This guided workflow prepares a Facebook Page setup worksheet. It asks for missing details and never accesses or submits to Facebook.</p></div><div className="task-workbench"><div className="task-request"><span>YOUR REQUEST</span><h3>“Help me set up a Facebook Page for my new shop.”</h3><div className="task-app-chip"><i>f</i><span><b>Facebook Page guidance</b><small>Local worksheet · no connector</small></span></div><button onClick={runDemo}>{demoStep<0?"Run the walkthrough":"Restart walkthrough"} <span>→</span></button></div><div className="task-plan"><div className="task-plan-head"><div><span>ORBIT’S PLAN</span><h3>One allowlisted local tool</h3></div><i className={demoStep>=0?"live":""}>{demoStep<0?"Ready":"Verifying"}</i></div>{taskSteps.map((item,index)=><article className={index<=demoStep?"active":""} key={item.title}><span>{index<demoStep?"✓":index+1}</span><div><b>{item.title}</b><small>{item.detail}</small></div><em>{item.risk}</em></article>)}{approved&&<div className="task-complete"><span>✓</span><div><b>Local result verified</b><small>The worksheet was prepared; no Facebook action occurred.</small></div></div>}</div></div></section>

    <section className="trend-nooks" id="nooks"><div className="trend-section-heading row"><div><span className="trend-kicker">STARTER LOOKS</span><h2>One honest mascot, three useful presets.</h2></div><p>These previews share the current procedural rig. Color, outfit, accessory, and working style are saved separately from capability.</p></div><div className="trend-nook-grid">{nookTypes.map((nook,index)=><article key={nook.name}><div className="trend-nook-stage" style={{background:`radial-gradient(circle at 50% 40%, ${nook.pale}, ${nook.color})`}}><Nook3D compact name={nook.name} primary={nook.color} secondary={nook.pale} outfit={index===0?"hoodie":index===1?"varsity":"utility"} accessory={index===0?"star":index===1?"cap":"antenna"} draggable={false} motion={index===0?"idle":index===1?"wave":"think"}/></div><div className="trend-nook-copy"><span>0{index+1}</span><div><h3>{nook.name}</h3><b>{nook.job}</b><p>{nook.note}</p></div></div></article>)}</div><div className="trend-closet-strip"><div><span className="trend-kicker">THE CLOSET</span><h3>Shirts, pins, hats, palettes, and saved outfits.</h3><p>Cosmetics are cosmetic. Equipping a shirt never changes what your Nook can access.</p></div><div className="closet-swatches"><span className="hoodie-swatch"/><span className="varsity-swatch"/><span className="vest-swatch"/><i>+12</i></div><a href="/create">Open the wardrobe <span>→</span></a></div></section>

    <section className="trend-boundary"><div className="boundary-copy"><span className="trend-kicker">PRODUCT BOUNDARY</span><h2>The web control room works now. Desktop movement is the next runtime.</h2><p>A browser page cannot safely walk across native apps or reuse logged-in sessions. A signed, narrowly permissioned desktop runtime remains a documented future phase.</p><a href="/dashboard">Open the control room <span>→</span></a></div><div className="boundary-diagram"><article><i>01</i><span><b>Nook Web · live</b><small>Identity, wardrobe, plans, approvals, verified receipts</small></span></article><em>→</em><article><i>02</i><span><b>Safe agent · live</b><small>Four allowlisted local tools and deterministic policy</small></span></article><em>→</em><article><i>03</i><span><b>Nook Desktop · later</b><small>Signed local app, movement, pairing, narrow grants</small></span></article></div></section>

    <section className="trend-safety" id="safety"><div className="trend-section-heading"><span className="trend-kicker">CUTE DOESN’T MEAN CARELESS</span><h2>Serious boundaries, written in plain language.</h2></div><div className="safety-shelves"><article><span>◎</span><h3>See the tool</h3><p>Every task shows the exact allowlisted tool, inputs, version, and risk.</p></article><article><span>✓</span><h3>Approve exactly once</h3><p>Reversible Nook preference changes pause before execution. External effects are unavailable.</p></article><article><span>↺</span><h3>Keep the receipt</h3><p>Review what was prepared, approved, attempted, verified, or failed.</p></article><article><span>⊘</span><h3>Never share secrets</h3><p>Passwords, OAuth tokens, and payment details never belong in a Nook prompt.</p></article></div></section>

    <section className="trend-build" id="build"><div><span className="trend-kicker">CREATOR MARKETPLACE · LATER</span><h2>The contract comes before creator uploads.</h2><p>The marketplace is a roadmap surface. Original rig validation, declarative packs, licensing, moderation, immutable versions, payouts, recalls, and support must work before creator selling opens.</p><div><a className="trend-primary" href="/dashboard/marketplace">Preview curated catalog <span>→</span></a><a href="/create">Customize the current Nook</a></div></div><aside><span>RELEASE GATES</span>{["Original rig and animation validation","Capability and cosmetic separation","Safety test scenarios","License, price, and support policy","Human review before listing"].map((item,index)=><p key={item}><i>{index+1}</i>{item}<b>{index===1?"Defined":"Required"}</b></p>)}</aside></section>

    <section className="trend-final"><Nook3D compact name="Orbit" motion="wave" outfit="hoodie" accessory="star" draggable={false}/><div><span className="trend-kicker">START WITH THE CHARACTER</span><h2>Make a Nook you’ll want to work with.</h2><p>Customize first. Sign in when you’re ready to save.</p></div><a className="trend-primary" href="/create">Create my Nook <span>→</span></a></section>
    <footer className="trend-footer"><a className="trend-brand" href="#top"><span>›_</span>nook</a><p>A visible, teachable desktop companion—built with honest boundaries.</p><div><a href="#task">How it works</a><a href="/create">Wardrobe</a><a href="#safety">Safety</a><a href="#build">Creators</a><a href="/dashboard">Product preview</a></div><small>© 2026 Nook Labs · Private product prototype</small></footer>
  </main>;
}
