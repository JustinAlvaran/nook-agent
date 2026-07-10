"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type NookMotion = "idle" | "listen" | "think" | "walk" | "drag" | "wave" | "success" | "sleep" | "error";
export type NookOutfit = "none" | "hoodie" | "varsity" | "utility";
export type NookAccessory = "none" | "cap" | "star" | "antenna";

export type Nook3DProps = {
  name?: string;
  primary?: string;
  secondary?: string;
  faceGlow?: string;
  outfit?: NookOutfit;
  accessory?: NookAccessory;
  motion?: NookMotion;
  message?: string;
  draggable?: boolean;
  compact?: boolean;
  onPositionChange?: (position: { x: number; y: number }) => void;
};

function RobotModel({ primary, secondary, faceGlow, outfit, accessory, motion, reducedMotion }: Required<Pick<Nook3DProps, "primary" | "secondary" | "faceGlow" | "outfit" | "accessory" | "motion">> & { reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const leftFoot = useRef<THREE.Mesh>(null);
  const rightFoot = useRef<THREE.Mesh>(null);
  const clock = useRef(0);

  useFrame(({ clock: sceneClock, pointer }, delta) => {
    if (!root.current || !head.current || !leftArm.current || !rightArm.current || !leftFoot.current || !rightFoot.current) return;
    clock.current += delta;
    const t = sceneClock.getElapsedTime();
    const bob = reducedMotion ? 0 : Math.sin(t * 2.1) * 0.035;
    root.current.position.y = bob;
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, reducedMotion ? 0 : pointer.x * 0.11, 0.04);
    head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, reducedMotion ? 0 : pointer.x * 0.2, 0.055);
    head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, reducedMotion ? 0 : -pointer.y * 0.11, 0.055);

    if (reducedMotion) {
      head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, 0, 0.12);
      root.current.position.x = THREE.MathUtils.lerp(root.current.position.x, 0, 0.12);
      root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, 0, 0.12);
      leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.25, 0.12);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.25, 0.12);
      leftFoot.current.rotation.z = THREE.MathUtils.lerp(leftFoot.current.rotation.z, 0, 0.12);
      rightFoot.current.rotation.z = THREE.MathUtils.lerp(rightFoot.current.rotation.z, 0, 0.12);
      return;
    }

    if (motion === "think") head.current.rotation.z = Math.sin(t * 1.8) * 0.12;
    else head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, 0, 0.08);

    if (motion === "walk") {
      root.current.position.x = Math.sin(t * 3.6) * 0.08;
      leftArm.current.rotation.z = Math.sin(t * 7.2) * 0.35;
      rightArm.current.rotation.z = -Math.sin(t * 7.2) * 0.35;
      leftFoot.current.rotation.z = Math.sin(t * 7.2) * 0.22;
      rightFoot.current.rotation.z = -Math.sin(t * 7.2) * 0.22;
    } else if (motion === "wave") {
      rightArm.current.rotation.z = -1 + Math.sin(t * 7) * 0.25;
    } else if (motion === "drag") {
      head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, 0.08, 0.08);
      leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.05, 0.08);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.05, 0.08);
    } else if (motion === "listen") {
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -0.08, 0.08);
    } else if (motion === "success") {
      root.current.rotation.z = Math.sin(t * 8) * 0.04;
      root.current.position.y = Math.abs(Math.sin(t * 4)) * 0.16;
    } else if (motion === "sleep") {
      root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, -0.08, 0.03);
    } else if (motion === "error") {
      root.current.position.x = Math.sin(t * 18) * 0.025;
    } else {
      root.current.position.x = THREE.MathUtils.lerp(root.current.position.x, 0, 0.08);
      root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, 0, 0.08);
      leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.25, 0.08);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.25, 0.08);
      leftFoot.current.rotation.z = THREE.MathUtils.lerp(leftFoot.current.rotation.z, 0, 0.08);
      rightFoot.current.rotation.z = THREE.MathUtils.lerp(rightFoot.current.rotation.z, 0, 0.08);
    }
  });

  const shirtColor = outfit === "hoodie" ? "#252a3a" : outfit === "varsity" ? "#f4eee4" : outfit === "utility" ? "#f1985e" : secondary;
  const eyeScale = motion === "sleep" ? 0.2 : motion === "listen" ? 1.18 : 1;

  return <group ref={root} scale={1.05}>
    <mesh position={[0, -1.18, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.25, .62, 1]}>
      <circleGeometry args={[.78, 32]}/><meshBasicMaterial color="#06070b" transparent opacity={.34}/>
    </mesh>

    <group ref={head} position={[0, .45, 0]}>
      <mesh scale={[1.05, .86, .78]}><sphereGeometry args={[1, 40, 30]}/><meshStandardMaterial color={primary} roughness={.5} metalness={.08}/></mesh>
      <mesh position={[0, -.03, .7]} scale={[.78, .48, .09]}><boxGeometry args={[1.6, 1, 1]}/><meshStandardMaterial color="#07101b" roughness={.24} metalness={.34}/></mesh>
      <mesh position={[-.3, .02, .8]} scale={[.16, .07 * eyeScale, .04]}><capsuleGeometry args={[.25, .34, 8, 16]}/><meshBasicMaterial color={faceGlow}/></mesh>
      <mesh position={[.3, .02, .8]} scale={[.16, .07 * eyeScale, .04]}><capsuleGeometry args={[.25, .34, 8, 16]}/><meshBasicMaterial color={faceGlow}/></mesh>
      <mesh position={[0, -.23, .8]} scale={[.12, .035, .035]}><boxGeometry/><meshBasicMaterial color={faceGlow}/></mesh>
      <mesh position={[-.92, .05, 0]} scale={[.22, .38, .3]} rotation={[0,0,-.18]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color={secondary}/></mesh>
      <mesh position={[.92, .05, 0]} scale={[.22, .38, .3]} rotation={[0,0,.18]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color={secondary}/></mesh>
      {accessory === "cap" && <group position={[0,.78,.02]}><mesh scale={[.72,.18,.56]}><sphereGeometry args={[1,28,16]}/><meshStandardMaterial color="#20263a"/></mesh><mesh position={[.24,-.03,.46]} scale={[.48,.06,.22]}><boxGeometry/><meshStandardMaterial color="#20263a"/></mesh></group>}
      {accessory === "antenna" && <group position={[0,.94,0]}><mesh scale={[.055,.33,.055]} position={[0,.15,0]}><cylinderGeometry args={[1,1,1,12]}/><meshStandardMaterial color={secondary}/></mesh><mesh position={[0,.43,0]} scale={.13}><sphereGeometry args={[1,20,16]}/><meshBasicMaterial color={faceGlow}/></mesh></group>}
    </group>

    <mesh position={[0,-.55,0]} scale={[.68,.66,.58]}><sphereGeometry args={[1,36,24]}/><meshStandardMaterial color={outfit === "none" ? primary : shirtColor} roughness={outfit === "none" ? .5 : .78}/></mesh>
    {outfit !== "none" && <mesh position={[0,-.52,.53]} scale={[.34,.28,.035]}><circleGeometry args={[1,28]}/><meshBasicMaterial color={outfit === "varsity" ? primary : secondary}/></mesh>}
    {accessory === "star" && <mesh position={[0,-.5,.61]} rotation={[0,0,.2]} scale={.17}><octahedronGeometry args={[1,0]}/><meshStandardMaterial color="#ffd469" emissive="#7a4d00" emissiveIntensity={.25}/></mesh>}
    <mesh ref={leftArm} position={[-.72,-.55,0]} rotation={[0,0,.25]} scale={[.22,.55,.22]}><capsuleGeometry args={[.55,.72,8,16]}/><meshStandardMaterial color={primary}/></mesh>
    <mesh ref={rightArm} position={[.72,-.55,0]} rotation={[0,0,-.25]} scale={[.22,.55,.22]}><capsuleGeometry args={[.55,.72,8,16]}/><meshStandardMaterial color={primary}/></mesh>
    <mesh ref={leftFoot} position={[-.34,-1.13,.05]} scale={[.34,.22,.44]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color={secondary}/></mesh>
    <mesh ref={rightFoot} position={[.34,-1.13,.05]} scale={[.34,.22,.44]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color={secondary}/></mesh>
  </group>;
}

export function Nook3D({ name="Orbit", primary="#617fff", secondary="#9db0ff", faceGlow="#7debff", outfit="hoodie", accessory="star", motion="idle", message, draggable=true, compact=false, onPositionChange }: Nook3DProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [webglFailed, setWebglFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const positionKey = `nook-position:${name}:${compact ? "compact" : "room"}`;

  useEffect(() => {
    if (!draggable) return;
    const saved = window.localStorage.getItem(positionKey);
    const frame = window.requestAnimationFrame(() => {
      if (saved) try { setOffset(JSON.parse(saved)); } catch { /* ignore invalid device draft */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draggable, positionKey]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x:event.clientX, y:event.clientY, ox:offset.x, oy:offset.y };
    setDragging(true);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const next = { x: Math.max(-150, Math.min(150, start.current.ox + event.clientX - start.current.x)), y: Math.max(-55, Math.min(70, start.current.oy + event.clientY - start.current.y)) };
    setOffset(next);
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false);
    window.localStorage.setItem(positionKey, JSON.stringify(offset)); onPositionChange?.(offset);
  }
  function moveBy(dx:number, dy:number) {
    const next={x:Math.max(-150,Math.min(150,offset.x+dx)),y:Math.max(-55,Math.min(70,offset.y+dy))}; setOffset(next); window.localStorage.setItem(positionKey,JSON.stringify(next)); onPositionChange?.(next);
  }

  return <div className={`nook3d ${compact ? "nook3d-compact" : ""} ${dragging ? "is-dragging" : ""}`} style={{ transform:`translate3d(${offset.x}px,${offset.y}px,0)` }}>
    {message && <div className="nook3d-bubble" role="status" aria-live="polite"><b>{name}</b><span>{message}</span></div>}
    <div className="nook3d-canvas" role={draggable ? "group" : "img"} aria-label={`${name}, your customizable Nook companion. ${dragging ? "Being repositioned." : `Current motion: ${motion}.`}`} tabIndex={draggable ? 0 : -1} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onKeyDown={(event)=>{if(!event.key.startsWith("Arrow"))return;event.preventDefault();const step=event.shiftKey?24:8;if(event.key==="ArrowLeft")moveBy(-step,0);if(event.key==="ArrowRight")moveBy(step,0);if(event.key==="ArrowUp")moveBy(0,-step);if(event.key==="ArrowDown")moveBy(0,step)}}>
      {!webglFailed ? <Canvas orthographic camera={{ position:[0,.1,6], zoom:90 }} dpr={[1,1.5]} gl={{ alpha:true, antialias:true, powerPreference:"high-performance" }} onCreated={({gl})=>gl.domElement.addEventListener("webglcontextlost",()=>setWebglFailed(true),{once:true})}>
        <ambientLight intensity={1.45}/><directionalLight position={[3,4,5]} intensity={2.2}/><directionalLight position={[-3,1,2]} intensity={.7} color="#7d8fff"/>
        <RobotModel primary={primary} secondary={secondary} faceGlow={faceGlow} outfit={outfit} accessory={accessory} motion={dragging?"drag":motion} reducedMotion={reducedMotion}/>
      </Canvas> : <div className="nook3d-fallback"><span>›_</span></div>}
    </div>
    {draggable && <span className="nook3d-drag-hint">Drag me · arrows also work</span>}
  </div>;
}
