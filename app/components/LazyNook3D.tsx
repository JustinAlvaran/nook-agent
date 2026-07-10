"use client";

import { lazy, Suspense } from "react";
import type { Nook3DProps } from "./Nook3D";

const Nook3D = lazy(() => import("./Nook3D").then((module) => ({ default: module.Nook3D })));

export function LazyNook3D(props: Nook3DProps) {
  return <Suspense fallback={<div className={`nook3d nook3d-loading ${props.compact ? "nook3d-compact" : ""}`} role="status" aria-label="Loading 3D Nook"><div className="nook3d-fallback"><span>›_</span></div></div>}><Nook3D {...props}/></Suspense>;
}
