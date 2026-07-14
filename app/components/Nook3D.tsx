"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  deriveNookMotionSignal,
  type NookMotionSignal,
} from "../../lib/agent/nook-motion";

export type NookMotion =
  | "idle"
  | "listen"
  | "think"
  | "walk"
  | "drag"
  | "wave"
  | "success"
  | "sleep"
  | "error";
export type NookAgentState =
  | "ready"
  | "planning"
  | "running"
  | "needs_input"
  | "needs_approval"
  | "completed"
  | "failed"
  | "blocked"
  | "offline";
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
  agentState?: NookAgentState;
  signal?: NookMotionSignal;
  message?: string;
  draggable?: boolean;
  compact?: boolean;
  onPositionChange?: (position: { x: number; y: number }) => void;
};

export const motionForAgentState: Record<NookAgentState, NookMotion> = {
  ready: "idle",
  planning: "think",
  running: "walk",
  needs_input: "listen",
  needs_approval: "listen",
  completed: "success",
  failed: "error",
  blocked: "error",
  offline: "sleep",
};

function TaskRoom({
  signal,
  reducedMotion,
}: {
  signal: NookMotionSignal;
  reducedMotion: boolean;
}) {
  const roomRoot = useRef<THREE.Group>(null);
  const sourceRig = useRef<THREE.Group>(null);
  const memoryRig = useRef<THREE.Group>(null);
  const actionRig = useRef<THREE.Group>(null);
  const accent =
    signal.state === "researching"
      ? "#66e7ff"
      : signal.state === "remembering"
        ? "#c5a9ff"
        : signal.state === "waiting"
          ? "#ffc45d"
          : signal.state === "warning" || signal.state === "error"
            ? "#f27c70"
            : signal.state === "presenting" || signal.state === "celebrating"
              ? "#82efb7"
              : "#7f8cff";

  useEffect(() => {
    if (!roomRoot.current) return;
    roomRoot.current.userData.sculptRuntime = {
      nodes: {
        memoryRack: roomRoot.current.getObjectByName("memory-rack"),
        sourceRack: roomRoot.current.getObjectByName("source-rack"),
        actionPlinth: roomRoot.current.getObjectByName("action-plinth"),
        statusRail: roomRoot.current.getObjectByName("status-rail"),
      },
      sockets: {
        nookHome: [0, -1.05, 0.45],
        memoryFocus: [-2.05, -0.05, 0.05],
        sourcesFocus: [2.03, 0.1, 0.05],
      },
      colliders: {
        floor: { type: "box", size: [6.4, 0.1, 4.9] },
        actionPlinth: { type: "cylinder", radius: 1.16, height: 0.35 },
      },
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (sourceRig.current) {
      const active = signal.focusTarget === "sources" && !reducedMotion;
      sourceRig.current.position.y = THREE.MathUtils.lerp(
        sourceRig.current.position.y,
        active ? Math.sin(t * 2.2) * 0.035 : 0,
        Math.min(1, delta * 5),
      );
    }
    if (memoryRig.current) {
      const active = signal.state === "remembering" && !reducedMotion;
      memoryRig.current.rotation.y = THREE.MathUtils.lerp(
        memoryRig.current.rotation.y,
        active ? Math.sin(t * 1.4) * 0.08 : 0,
        Math.min(1, delta * 4),
      );
    }
    if (actionRig.current) {
      const active = signal.state === "working" && !reducedMotion;
      actionRig.current.position.x = THREE.MathUtils.lerp(
        actionRig.current.position.x,
        active ? Math.sin(t * 3) * 0.04 : 0,
        Math.min(1, delta * 5),
      );
    }
  });

  return (
    <group ref={roomRoot} name="nook-task-room" position={[0, 0.05, -1.05]}>
      <mesh position={[0, 0.1, -0.35]} scale={[3.2, 2.2, 0.08]}>
        <boxGeometry />
        <meshStandardMaterial color="#171921" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, -1.32, 1.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[3.2, 2.45, 1]} receiveShadow>
        <planeGeometry />
        <meshStandardMaterial color="#101218" roughness={0.9} metalness={0.05} />
      </mesh>
      <gridHelper args={[6.4, 18, "#343846", "#242733"]} position={[0, -1.31, 1.1]} />

      <group ref={memoryRig} name="memory-rack" position={[-2.05, -0.05, 0.05]}>
        <mesh position={[0, 0, 0]} scale={[0.62, 1.65, 0.22]}>
          <boxGeometry />
          <meshStandardMaterial color="#20232d" roughness={0.72} metalness={0.18} />
        </mesh>
        {[0.56, 0.05, -0.46].map((y, index) => (
          <group key={y} position={[0, y, 0.26]}>
            <mesh scale={[0.43, 0.18, 0.08]}>
              <boxGeometry />
              <meshStandardMaterial color={index === 0 && signal.state === "remembering" ? accent : "#353a48"} emissive={accent} emissiveIntensity={index === 0 && signal.state === "remembering" ? 0.55 : 0.03} roughness={0.55} />
            </mesh>
            <mesh position={[-0.3, 0, 0.1]} scale={[0.035, 0.05, 0.02]}>
              <boxGeometry />
              <meshBasicMaterial color={index === 0 && signal.state === "remembering" ? "#ffffff" : "#747b8e"} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={sourceRig} name="source-rack" position={[2.03, 0.1, 0.05]}>
        {[-0.5, 0, 0.5].map((y, index) => (
          <group key={y} position={[index === 1 ? -0.1 : 0.05, y, index * 0.06]} rotation={[0, index === 1 ? -0.08 : 0.04, 0]}>
            <mesh scale={[0.68, 0.34, 0.055]}>
              <boxGeometry />
              <meshStandardMaterial color="#f2f0e9" emissive={signal.focusTarget === "sources" ? accent : "#000000"} emissiveIntensity={signal.focusTarget === "sources" ? 0.12 + index * 0.05 : 0} roughness={0.64} />
            </mesh>
            <mesh position={[-0.38, 0.1, 0.065]} scale={[0.09, 0.025, 0.01]}>
              <boxGeometry />
              <meshBasicMaterial color={signal.focusTarget === "sources" ? accent : "#747b8e"} />
            </mesh>
            <mesh position={[0.04, -0.02, 0.065]} scale={[0.42, 0.018, 0.01]}>
              <boxGeometry />
              <meshBasicMaterial color="#8a8f9d" />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={actionRig} name="action-plinth" position={[0, -1.18, 0.45]}>
        <mesh scale={[1.16, 0.16, 0.72]} castShadow receiveShadow>
          <cylinderGeometry args={[1, 1.08, 0.35, 48]} />
          <meshStandardMaterial color="#252936" metalness={0.38} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.18, 0]} scale={[0.86, 0.04, 0.52]}>
          <cylinderGeometry args={[1, 1, 0.2, 48]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={signal.state === "idle" ? 0.12 : 0.48} roughness={0.35} />
        </mesh>
      </group>

      <group name="status-rail" position={[0, 1.48, -0.18]}>
        <mesh scale={[1.15, 0.19, 0.05]}>
          <boxGeometry />
          <meshStandardMaterial color="#0b0d12" roughness={0.48} metalness={0.25} />
        </mesh>
        {[ -0.72, -0.24, 0.24, 0.72 ].map((x, index) => (
          <mesh key={x} position={[x, 0, 0.065]} scale={[0.12, 0.035, 0.015]}>
            <boxGeometry />
            <meshBasicMaterial color={index === 0 || signal.state !== "idle" ? accent : "#4b5060"} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RobotModel({
  primary,
  secondary,
  faceGlow,
  outfit,
  accessory,
  motion,
  reducedMotion,
}: Required<
  Pick<
    Nook3DProps,
    "primary" | "secondary" | "faceGlow" | "outfit" | "accessory" | "motion"
  >
> & { reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const leftFoot = useRef<THREE.Mesh>(null);
  const rightFoot = useRef<THREE.Mesh>(null);
  const clock = useRef(0);

  useFrame(({ clock: sceneClock, pointer }, delta) => {
    if (
      !root.current ||
      !head.current ||
      !leftArm.current ||
      !rightArm.current ||
      !leftFoot.current ||
      !rightFoot.current
    )
      return;
    clock.current += delta;
    const t = sceneClock.getElapsedTime();
    const bob = reducedMotion ? 0 : Math.sin(t * 2.1) * 0.035;
    root.current.position.y = bob;
    root.current.rotation.y = THREE.MathUtils.lerp(
      root.current.rotation.y,
      reducedMotion ? 0 : pointer.x * 0.11,
      0.04,
    );
    head.current.rotation.y = THREE.MathUtils.lerp(
      head.current.rotation.y,
      reducedMotion ? 0 : pointer.x * 0.2,
      0.055,
    );
    head.current.rotation.x = THREE.MathUtils.lerp(
      head.current.rotation.x,
      reducedMotion ? 0 : -pointer.y * 0.11,
      0.055,
    );

    if (reducedMotion) {
      head.current.rotation.z = THREE.MathUtils.lerp(
        head.current.rotation.z,
        0,
        0.12,
      );
      root.current.position.x = THREE.MathUtils.lerp(
        root.current.position.x,
        0,
        0.12,
      );
      root.current.rotation.z = THREE.MathUtils.lerp(
        root.current.rotation.z,
        0,
        0.12,
      );
      leftArm.current.rotation.z = THREE.MathUtils.lerp(
        leftArm.current.rotation.z,
        0.25,
        0.12,
      );
      rightArm.current.rotation.z = THREE.MathUtils.lerp(
        rightArm.current.rotation.z,
        -0.25,
        0.12,
      );
      leftFoot.current.rotation.z = THREE.MathUtils.lerp(
        leftFoot.current.rotation.z,
        0,
        0.12,
      );
      rightFoot.current.rotation.z = THREE.MathUtils.lerp(
        rightFoot.current.rotation.z,
        0,
        0.12,
      );
      return;
    }

    if (motion === "think") head.current.rotation.z = Math.sin(t * 1.8) * 0.12;
    else
      head.current.rotation.z = THREE.MathUtils.lerp(
        head.current.rotation.z,
        0,
        0.08,
      );

    if (motion === "walk") {
      root.current.position.x = Math.sin(t * 3.6) * 0.08;
      leftArm.current.rotation.z = Math.sin(t * 7.2) * 0.35;
      rightArm.current.rotation.z = -Math.sin(t * 7.2) * 0.35;
      leftFoot.current.rotation.z = Math.sin(t * 7.2) * 0.22;
      rightFoot.current.rotation.z = -Math.sin(t * 7.2) * 0.22;
    } else if (motion === "wave") {
      rightArm.current.rotation.z = -1 + Math.sin(t * 7) * 0.25;
    } else if (motion === "drag") {
      head.current.rotation.z = THREE.MathUtils.lerp(
        head.current.rotation.z,
        0.08,
        0.08,
      );
      leftArm.current.rotation.z = THREE.MathUtils.lerp(
        leftArm.current.rotation.z,
        0.05,
        0.08,
      );
      rightArm.current.rotation.z = THREE.MathUtils.lerp(
        rightArm.current.rotation.z,
        -0.05,
        0.08,
      );
    } else if (motion === "listen") {
      head.current.rotation.x = THREE.MathUtils.lerp(
        head.current.rotation.x,
        -0.08,
        0.08,
      );
    } else if (motion === "success") {
      root.current.rotation.z = Math.sin(t * 8) * 0.04;
      root.current.position.y = Math.abs(Math.sin(t * 4)) * 0.16;
    } else if (motion === "sleep") {
      root.current.rotation.z = THREE.MathUtils.lerp(
        root.current.rotation.z,
        -0.08,
        0.03,
      );
    } else if (motion === "error") {
      root.current.position.x = Math.sin(t * 18) * 0.025;
    } else {
      root.current.position.x = THREE.MathUtils.lerp(
        root.current.position.x,
        0,
        0.08,
      );
      root.current.rotation.z = THREE.MathUtils.lerp(
        root.current.rotation.z,
        0,
        0.08,
      );
      leftArm.current.rotation.z = THREE.MathUtils.lerp(
        leftArm.current.rotation.z,
        0.25,
        0.08,
      );
      rightArm.current.rotation.z = THREE.MathUtils.lerp(
        rightArm.current.rotation.z,
        -0.25,
        0.08,
      );
      leftFoot.current.rotation.z = THREE.MathUtils.lerp(
        leftFoot.current.rotation.z,
        0,
        0.08,
      );
      rightFoot.current.rotation.z = THREE.MathUtils.lerp(
        rightFoot.current.rotation.z,
        0,
        0.08,
      );
    }
  });

  const shirtColor =
    outfit === "hoodie"
      ? "#252a3a"
      : outfit === "varsity"
        ? "#f4eee4"
        : outfit === "utility"
          ? "#f1985e"
          : secondary;
  const eyeScale = motion === "sleep" ? 0.2 : motion === "listen" ? 1.18 : 1;

  return (
    <group ref={root} scale={1.05}>
      <mesh
        position={[0, -1.18, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.25, 0.62, 1]}
      >
        <circleGeometry args={[0.78, 32]} />
        <meshBasicMaterial color="#06070b" transparent opacity={0.34} />
      </mesh>

      <group ref={head} position={[0, 0.45, 0]}>
        <mesh scale={[1.05, 0.86, 0.78]}>
          <sphereGeometry args={[1, 40, 30]} />
          <meshStandardMaterial
            color={primary}
            roughness={0.5}
            metalness={0.08}
          />
        </mesh>
        <mesh position={[0, -0.03, 0.7]} scale={[0.78, 0.48, 0.09]}>
          <boxGeometry args={[1.6, 1, 1]} />
          <meshStandardMaterial
            color="#07101b"
            roughness={0.24}
            metalness={0.34}
          />
        </mesh>
        <mesh
          position={[-0.3, 0.02, 0.8]}
          scale={[0.16, 0.07 * eyeScale, 0.04]}
        >
          <capsuleGeometry args={[0.25, 0.34, 8, 16]} />
          <meshBasicMaterial color={faceGlow} />
        </mesh>
        <mesh position={[0.3, 0.02, 0.8]} scale={[0.16, 0.07 * eyeScale, 0.04]}>
          <capsuleGeometry args={[0.25, 0.34, 8, 16]} />
          <meshBasicMaterial color={faceGlow} />
        </mesh>
        <mesh position={[0, -0.23, 0.8]} scale={[0.12, 0.035, 0.035]}>
          <boxGeometry />
          <meshBasicMaterial color={faceGlow} />
        </mesh>
        <mesh
          position={[-0.92, 0.05, 0]}
          scale={[0.22, 0.38, 0.3]}
          rotation={[0, 0, -0.18]}
        >
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={secondary} />
        </mesh>
        <mesh
          position={[0.92, 0.05, 0]}
          scale={[0.22, 0.38, 0.3]}
          rotation={[0, 0, 0.18]}
        >
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={secondary} />
        </mesh>
        {accessory === "cap" && (
          <group position={[0, 0.78, 0.02]}>
            <mesh scale={[0.72, 0.18, 0.56]}>
              <sphereGeometry args={[1, 28, 16]} />
              <meshStandardMaterial color="#20263a" />
            </mesh>
            <mesh position={[0.24, -0.03, 0.46]} scale={[0.48, 0.06, 0.22]}>
              <boxGeometry />
              <meshStandardMaterial color="#20263a" />
            </mesh>
          </group>
        )}
        {accessory === "antenna" && (
          <group position={[0, 0.94, 0]}>
            <mesh scale={[0.055, 0.33, 0.055]} position={[0, 0.15, 0]}>
              <cylinderGeometry args={[1, 1, 1, 12]} />
              <meshStandardMaterial color={secondary} />
            </mesh>
            <mesh position={[0, 0.43, 0]} scale={0.13}>
              <sphereGeometry args={[1, 20, 16]} />
              <meshBasicMaterial color={faceGlow} />
            </mesh>
          </group>
        )}
      </group>

      <mesh position={[0, -0.55, 0]} scale={[0.68, 0.66, 0.58]}>
        <sphereGeometry args={[1, 36, 24]} />
        <meshStandardMaterial
          color={outfit === "none" ? primary : shirtColor}
          roughness={outfit === "none" ? 0.5 : 0.78}
        />
      </mesh>
      {outfit !== "none" && (
        <mesh position={[0, -0.52, 0.53]} scale={[0.34, 0.28, 0.035]}>
          <circleGeometry args={[1, 28]} />
          <meshBasicMaterial
            color={outfit === "varsity" ? primary : secondary}
          />
        </mesh>
      )}
      {accessory === "star" && (
        <mesh position={[0, -0.5, 0.61]} rotation={[0, 0, 0.2]} scale={0.17}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#ffd469"
            emissive="#7a4d00"
            emissiveIntensity={0.25}
          />
        </mesh>
      )}
      <mesh
        ref={leftArm}
        position={[-0.72, -0.55, 0]}
        rotation={[0, 0, 0.25]}
        scale={[0.22, 0.55, 0.22]}
      >
        <capsuleGeometry args={[0.55, 0.72, 8, 16]} />
        <meshStandardMaterial color={primary} />
      </mesh>
      <mesh
        ref={rightArm}
        position={[0.72, -0.55, 0]}
        rotation={[0, 0, -0.25]}
        scale={[0.22, 0.55, 0.22]}
      >
        <capsuleGeometry args={[0.55, 0.72, 8, 16]} />
        <meshStandardMaterial color={primary} />
      </mesh>
      <mesh
        ref={leftFoot}
        position={[-0.34, -1.13, 0.05]}
        scale={[0.34, 0.22, 0.44]}
      >
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color={secondary} />
      </mesh>
      <mesh
        ref={rightFoot}
        position={[0.34, -1.13, 0.05]}
        scale={[0.34, 0.22, 0.44]}
      >
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color={secondary} />
      </mesh>
    </group>
  );
}

export function Nook3D({
  name = "Orbit",
  primary = "#617fff",
  secondary = "#9db0ff",
  faceGlow = "#7debff",
  outfit = "hoodie",
  accessory = "star",
  motion = "idle",
  agentState,
  signal,
  message,
  draggable = false,
  compact = false,
  onPositionChange,
}: Nook3DProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [webglFailed, setWebglFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const positionKey = `nook-position:${name}:${compact ? "compact" : "room"}`;

  useEffect(() => {
    if (!draggable) return;
    const saved = window.localStorage.getItem(positionKey);
    const frame = window.requestAnimationFrame(() => {
      if (saved)
        try {
          setOffset(JSON.parse(saved));
        } catch {
          /* ignore invalid device draft */
        }
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
  useEffect(() => {
    const update = () => setMotionPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    update();
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    setDragging(true);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const next = {
      x: Math.max(
        -150,
        Math.min(150, start.current.ox + event.clientX - start.current.x),
      ),
      y: Math.max(
        -55,
        Math.min(70, start.current.oy + event.clientY - start.current.y),
      ),
    };
    setOffset(next);
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    window.localStorage.setItem(positionKey, JSON.stringify(offset));
    onPositionChange?.(offset);
  }
  function moveBy(dx: number, dy: number) {
    const next = {
      x: Math.max(-150, Math.min(150, offset.x + dx)),
      y: Math.max(-55, Math.min(70, offset.y + dy)),
    };
    setOffset(next);
    window.localStorage.setItem(positionKey, JSON.stringify(next));
    onPositionChange?.(next);
  }
  function resetPosition() {
    const next = { x: 0, y: 0 };
    setOffset(next);
    window.localStorage.removeItem(positionKey);
    onPositionChange?.(next);
  }

  const resolvedSignal =
    signal ?? deriveNookMotionSignal(agentState ?? "ready");
  const signalMotion: Record<NookMotionSignal["state"], NookMotion> = {
    idle: "idle",
    listening: "listen",
    understanding: "think",
    remembering: "think",
    researching: "think",
    planning: "think",
    asking: "listen",
    waiting: "listen",
    working: "wave",
    checking: "think",
    presenting: "wave",
    celebrating: "success",
    warning: "error",
    error: "error",
    sleeping: "sleep",
  };
  const resolvedMotion = signal
    ? signalMotion[resolvedSignal.state]
    : agentState
      ? motionForAgentState[agentState]
      : motion;

  return (
    <div
      className={`nook3d ${compact ? "nook3d-compact" : ""} ${dragging ? "is-dragging" : ""} nook3d-state-${agentState ?? "ready"}`}
      style={{ transform: `translate3d(${offset.x}px,${offset.y}px,0)` }}
    >
      {!hidden && message && (
        <div className="nook3d-bubble">
          <b>
            {name} · {resolvedSignal.state}
          </b>
          <span>{message}</span>
        </div>
      )}
      {!hidden && (
        <div
          className={`nook3d-cue cue-${resolvedSignal.state}`}
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </div>
      )}
      {!hidden && (
        <div
          className="nook3d-canvas"
          role={draggable ? "group" : "img"}
          aria-label={`${name}, your customizable Nook companion. ${dragging ? "Being repositioned." : `Current state: ${agentState ?? resolvedMotion}.`}`}
          tabIndex={draggable ? 0 : -1}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={(event) => {
            if (!event.key.startsWith("Arrow")) return;
            event.preventDefault();
            const step = event.shiftKey ? 24 : 8;
            if (event.key === "ArrowLeft") moveBy(-step, 0);
            if (event.key === "ArrowRight") moveBy(step, 0);
            if (event.key === "ArrowUp") moveBy(0, -step);
            if (event.key === "ArrowDown") moveBy(0, step);
          }}
        >
          {!webglFailed ? (
            <Canvas
              fallback={
                <div className="nook3d-fallback">
                  <span>&gt;_</span>
                </div>
              }
              orthographic
              shadows
              camera={{ position: [0, 0.15, 6], zoom: 82 }}
              dpr={[1, 1.5]}
              gl={{
                alpha: true,
                antialias: true,
                powerPreference: "high-performance",
              }}
              onCreated={({ gl }) =>
                gl.domElement.addEventListener(
                  "webglcontextlost",
                  () => setWebglFailed(true),
                  { once: true },
                )
              }
            >
              <ambientLight intensity={1.45} />
              <directionalLight position={[3, 4, 5]} intensity={2.2} />
              <directionalLight
                position={[-3, 1, 2]}
                intensity={0.7}
                color="#7d8fff"
              />
              <pointLight position={[0, -0.4, 2]} intensity={0.55} color={faceGlow} distance={5} />
              <TaskRoom
                signal={resolvedSignal}
                reducedMotion={reducedMotion || motionPaused}
              />
              <RobotModel
                primary={primary}
                secondary={secondary}
                faceGlow={faceGlow}
                outfit={outfit}
                accessory={accessory}
                motion={dragging ? "drag" : resolvedMotion}
                reducedMotion={reducedMotion || motionPaused}
              />
            </Canvas>
          ) : (
            <div className="nook3d-fallback">
              <span>&gt;_</span>
            </div>
          )}
        </div>
      )}
      {draggable && (
        <div
          className="nook3d-controls"
          aria-label={`${name} movement controls`}
        >
          <button
            type="button"
            onClick={() => moveBy(-16, 0)}
            aria-label={`Move ${name} left`}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => moveBy(0, -16)}
            aria-label={`Move ${name} up`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveBy(0, 16)}
            aria-label={`Move ${name} down`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => moveBy(16, 0)}
            aria-label={`Move ${name} right`}
          >
            →
          </button>
          <button type="button" onClick={resetPosition}>
            Reset
          </button>
          <button
            type="button"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((value) => !value)}
          >
            {motionPaused ? "Resume motion" : "Pause motion"}
          </button>
          <button
            type="button"
            aria-pressed={hidden}
            onClick={() => setHidden((value) => !value)}
          >
            {hidden ? "Show Nook" : "Hide Nook"}
          </button>
        </div>
      )}
    </div>
  );
}
