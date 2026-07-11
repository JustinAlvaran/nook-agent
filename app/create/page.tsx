"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LazyNook3D as Nook3D } from "../components/LazyNook3D";
import type { NookAccessory, NookMotion, NookOutfit } from "../components/Nook3D";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

const colors = [
  { name:"Nook blue", primary:"#617fff", secondary:"#9db0ff", glow:"#7debff" },
  { name:"Tangerine", primary:"#ff825f", secondary:"#ffb49e", glow:"#ffe283" },
  { name:"Mint", primary:"#47cfa9", secondary:"#a2ead8", glow:"#87f7ff" },
  { name:"Grape", primary:"#9a7dff", secondary:"#cbbdff", glow:"#7debff" },
  { name:"Charcoal", primary:"#3c4354", secondary:"#7c859c", glow:"#80f1ff" },
];
const outfits: { id:NookOutfit; name:string; note:string }[] = [
  { id:"hoodie", name:"Midnight hoodie", note:"Starter · owned" },
  { id:"varsity", name:"Cloud varsity", note:"Starter · owned" },
  { id:"utility", name:"Task vest", note:"Free with beta" },
  { id:"none", name:"Classic shell", note:"Always available" },
];
const accessories: { id:NookAccessory; name:string }[] = [
  { id:"star", name:"Star pin" }, { id:"cap", name:"Focus cap" }, { id:"antenna", name:"Signal antenna" }, { id:"none", name:"No accessory" },
];
const personalities = [
  { id:"calm", name:"Calm guide", desc:"Explains the plan, stays quiet while working, and checks in at key decisions.", motion:"idle" as NookMotion },
  { id:"quick", name:"Quick helper", desc:"Uses shorter updates and prioritizes speed for familiar, low-risk tasks.", motion:"walk" as NookMotion },
  { id:"curious", name:"Curious scout", desc:"Suggests options, asks more questions, and celebrates what it learns.", motion:"wave" as NookMotion },
];
type BehaviorSettings={initiative:"low"|"balanced"|"proactive";explanationDepth:"brief"|"clear"|"deep";updateFrequency:"quiet"|"milestones"|"frequent"};
const presetBehavior:Record<string,BehaviorSettings>={calm:{initiative:"low",explanationDepth:"clear",updateFrequency:"milestones"},quick:{initiative:"balanced",explanationDepth:"brief",updateFrequency:"quiet"},curious:{initiative:"proactive",explanationDepth:"deep",updateFrequency:"frequent"}};

export default function CreateNook() {
  const [step,setStep]=useState(0);
  const [name,setName]=useState("Orbit");
  const [color,setColor]=useState(colors[0]);
  const [outfit,setOutfit]=useState<NookOutfit>("hoodie");
  const [accessory,setAccessory]=useState<NookAccessory>("star");
  const [personality,setPersonality]=useState(personalities[0]);
  const [behavior,setBehavior]=useState<BehaviorSettings>(presetBehavior.calm);
  const [notice,setNotice]=useState("");
  const [saved,setSaved]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [savingAccount,setSavingAccount]=useState(false);
  const message=useMemo(()=>step===0?`Hi, I’m ${name || "your Nook"}.`:step===1?"That look feels like me.":step===2?personality.desc.split(".")[0]+".":"Save me so we can keep learning together.",[step,name,personality]);

  useEffect(()=>{
    const stored=window.localStorage.getItem("nook-creator-draft");
    if(stored)try{
      const draft=JSON.parse(stored);
      const savedColor=colors.find((item)=>item.name===draft.color?.name)||colors.find((item)=>item.primary===draft.color?.primary);
      const savedPersonality=personalities.find((item)=>item.id===draft.personality);
      if(typeof draft.name==="string")setName(draft.name);
      if(savedColor)setColor(savedColor);
      if(outfits.some((item)=>item.id===draft.outfit))setOutfit(draft.outfit);
      if(accessories.some((item)=>item.id===draft.accessory))setAccessory(draft.accessory);
      if(savedPersonality)setPersonality(savedPersonality);
      if(draft.behavior)setBehavior(draft.behavior);
    }catch{/* ignore invalid device draft */}
    setHydrated(true);
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    const draft={name,color,outfit,accessory,personality:personality.id,behavior};
    window.localStorage.setItem("nook-creator-draft",JSON.stringify(draft));
    setSaved(true); const timer=window.setTimeout(()=>setSaved(false),650); return()=>window.clearTimeout(timer);
  },[hydrated,name,color,outfit,accessory,personality,behavior]);

  async function provider(provider:"Google"|"GitHub") {
    setNotice(`Opening ${provider} securely…`);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider.toLowerCase() as "google" | "github",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/create?save=1")}` },
      });
      if (error) throw error;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${provider} sign-in could not start.`);
    }
  }

  async function saveToAccount() {
    if(savingAccount)return;
    setSavingAccount(true);setNotice("Saving your Nook securely...");
    try{
      const response=await fetch("/api/nooks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,primary:color.primary,secondary:color.secondary,faceGlow:color.glow,outfit,accessory,workingStyle:personality.id,...behavior})});
      if(response.status===401){window.location.href="/auth/sign-in?next=/create?save=1";return;}
      const result=await response.json() as { error?: string };
      if(!response.ok)throw new Error(result.error||"Could not save your Nook.");
      setNotice(`${name || "Your Nook"} is saved to your account.`);
      window.setTimeout(()=>{window.location.href="/dashboard"},650);
    }catch(error){setNotice(error instanceof Error?error.message:"Could not save your Nook.");setSavingAccount(false);}
  }

  useEffect(()=>{
    if(!hydrated||new URLSearchParams(window.location.search).get("save")!=="1")return;
    void saveToAccount();
    // The account save intentionally runs once after the sign-in redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hydrated]);

  return <main className="onboard-shell">
    <header className="onboard-header"><Link className="onboard-brand" href="/"><span>›_</span>nook</Link><div className="onboard-progress" aria-label={`Step ${step+1} of 4`}><i style={{width:`${((step+1)/4)*100}%`}}/></div><span className="onboard-save">{saved?"Saving this-device draft…":"Draft saved on this device"}</span><Link href="/">Exit to website</Link></header>
    <div className="onboard-layout">
      <aside className="onboard-steps"><span>CREATE YOUR NOOK</span>{["Meet your Nook","Choose a look","Working style","Save your Nook"].map((item,index)=><button key={item} className={step===index?"active":step>index?"done":""} onClick={()=>setStep(index)}><i>{step>index?"✓":index+1}</i><div><b>{item}</b><small>{index===0?"Name and color":index===1?"Outfit and accessories":index===2?"How they help":"Sign in to keep them"}</small></div></button>)}</aside>
      <section className="onboard-stage"><div className="room-grid"/><div className="room-shelf"><span/><span/><span/></div><div className="room-window"><i/><i/></div><Nook3D name={name || "Nook"} primary={color.primary} secondary={color.secondary} faceGlow={color.glow} outfit={outfit} accessory={accessory} motion={personality.motion} message={message}/><div className="stage-note"><span>LIVE 3D PREVIEW</span><small>Drag your Nook to move them · use arrow keys for precise placement</small></div></section>
      <section className="onboard-panel">
        {step===0&&<><div className="panel-heading"><span>01 · MEET YOUR NOOK</span><h1>Make them yours.</h1><p>This is a live preview. You can change everything later.</p></div><label className="field-label" htmlFor="nook-name">What should we call them?</label><input className="name-field" id="nook-name" maxLength={18} value={name} onChange={(e)=>setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g,""))}/><div className="field-row"><span className="field-label">Body color</span><small>{color.name}</small></div><div className="color-picks">{colors.map((item)=><button aria-label={item.name} aria-pressed={color.name===item.name} style={{background:item.primary}} className={color.name===item.name?"active":""} key={item.name} onClick={()=>setColor(item)}/>)}</div><div className="tip-card"><span>✦</span><div><b>A color, not a capability</b><p>Appearance never changes what your Nook can access or do.</p></div></div></>}
        {step===1&&<><div className="panel-heading"><span>02 · CHOOSE A LOOK</span><h1>First outfit.</h1><p>Try on starter wardrobe pieces. Cosmetics never add permissions.</p></div><span className="field-label">Tops</span><div className="wardrobe-list">{outfits.map((item)=><button aria-pressed={outfit===item.id} className={outfit===item.id?"active":""} key={item.id} onClick={()=>setOutfit(item.id)}><i className={`fabric fabric-${item.id}`}/><div><b>{item.name}</b><small>{item.note}</small></div><span>{outfit===item.id?"Wearing":"Try on"}</span></button>)}</div><span className="field-label accessory-label">Accessories</span><div className="accessory-grid">{accessories.map((item)=><button aria-pressed={accessory===item.id} className={accessory===item.id?"active":""} key={item.id} onClick={()=>setAccessory(item.id)}><i>{item.id==="star"?"★":item.id==="cap"?"⌒":item.id==="antenna"?"•":"–"}</i><span>{item.name}</span></button>)}</div></>}
        {step===2&&<><div className="panel-heading"><span>03 · WORKING STYLE</span><h1>How should {name || "your Nook"} help?</h1><p>Start with a preset, then tune the three behaviors that actually affect the agent.</p></div><div className="personality-list">{personalities.map((item)=><button aria-pressed={personality.id===item.id} className={personality.id===item.id?"active":""} key={item.id} onClick={()=>{setPersonality(item);setBehavior(presetBehavior[item.id])}}><span>{item.id==="calm"?"□":item.id==="quick"?"↗":"✦"}</span><div><b>{item.name}</b><p>{item.desc}</p></div><i>{personality.id===item.id?"✓":""}</i></button>)}</div><div className="behavior-controls"><BehaviorChoice label="Initiative" value={behavior.initiative} options={["low","balanced","proactive"]} onChange={value=>setBehavior({...behavior,initiative:value as BehaviorSettings["initiative"]})}/><BehaviorChoice label="Explanation" value={behavior.explanationDepth} options={["brief","clear","deep"]} onChange={value=>setBehavior({...behavior,explanationDepth:value as BehaviorSettings["explanationDepth"]})}/><BehaviorChoice label="Updates" value={behavior.updateFrequency} options={["quiet","milestones","frequent"]} onChange={value=>setBehavior({...behavior,updateFrequency:value as BehaviorSettings["updateFrequency"]})}/></div><div className="behavior-preview"><b>Example behavior</b><p>{behavior.initiative==="proactive"?"I made the requested draft and added two optional next steps. Nothing external changed.":behavior.explanationDepth==="brief"?"Draft ready. Here are the three decisions that matter.":"I prepared the work, checked its assumptions, and marked what still needs your decision."}</p></div></>}
        {step===3&&<><div className="panel-heading"><span>04 · SAVE YOUR NOOK</span><h1>Keep {name || "your Nook"} with you.</h1><p>Sign in to save this Nook to one account. Connected services are added separately later.</p></div><div className="auth-summary"><span style={{background:color.primary}}/><div><b>{name || "My Nook"}</b><small>{personality.name} · {outfits.find((item)=>item.id===outfit)?.name}</small></div><i>Device draft ready</i></div><button className="provider-button google" onClick={()=>provider("Google")}><span>G</span>Continue with Google</button><button className="provider-button github" onClick={()=>provider("GitHub")}><span>⌁</span>Continue with GitHub</button><button className="provider-button chatgpt" onClick={saveToAccount} disabled={savingAccount}><span>✦</span>{savingAccount?"Saving…":"Save to my signed-in account"}</button>{notice&&<div className="auth-notice" role="status"><b>Account status</b><p>{notice}</p></div>}<p className="auth-terms">Google and GitHub are used only to sign in. Provider passwords stay on the provider page. Workspace and social connectors are authorized separately.</p></>}
        <div className="onboard-actions"><button className="back-button" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>Back</button>{step<3?<button className="next-button" onClick={()=>setStep(step+1)}>Continue <span>→</span></button>:<button className="next-button" onClick={saveToAccount} disabled={savingAccount}>{savingAccount?"Saving…":"Save and open my room"} <span>→</span></button>}</div>
      </section>
    </div>
  </main>;
}

function BehaviorChoice({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(value:string)=>void}){return <fieldset><legend>{label}</legend><div>{options.map(option=><button type="button" key={option} aria-pressed={value===option} className={value===option?"active":""} onClick={()=>onChange(option)}>{option}</button>)}</div></fieldset>}
