# Nook mascot and wardrobe contract

## Runtime decision

Use a custom low-poly Blender rig exported as GLB and render it with React Three Fiber. Keep the CSS mascot as the loading, reduced-motion, unsupported-WebGL, and marketplace-card fallback.

The web product should render one primary live companion canvas. Marketplace grids use WebP turntables; a detail preview can activate a reusable canvas. Screen-wide walking belongs to Nook Desktop, not the website.

## Required motion states

```text
idle → notice → listen → think → walk → work → approval → celebrate → settle
```

Additional states: drag, wave, sleep, error.

The procedural `Nook3D` component in this repository demonstrates the runtime contract before a final GLB exists. It supports live materials, a shirt layer, head/chest accessories, pointer gaze, task motions, speech bubbles, pointer drag, keyboard movement, device-local position, and a WebGL fallback.

## GLB animation clips

| Clip | Contract |
| --- | --- |
| `idle` | 3–5 second loop with breathing and occasional blink |
| `listen` | Looping attentive lean and head lift |
| `think` | Looping head tilt and face scan |
| `walk` | 0.7–0.9 second seamless in-place cycle |
| `drag` | Static or subtle dangling pose |
| `wave` | 1.3–1.8 second one-shot |
| `success` | 1.0–1.4 second one-shot hop/celebration |
| `sleep` | Slow loop with dim face |
| `error` | Brief recoil followed by concerned idle |

Crossfade clips over 150–250ms. Wave, success, and error are one-shot clips that clamp at the end.

## Rig

```text
Root
├── Body
├── Head
│   ├── Eye_L
│   ├── Eye_R
│   └── FaceScreen
├── Arm_L
├── Arm_R
├── Leg_L
├── Leg_R
└── sockets
    ├── socket_head
    ├── socket_chest
    ├── socket_back
    ├── socket_hand_l
    └── socket_hand_r
```

Material slots:

- `MAT_Primary`
- `MAT_Secondary`
- `MAT_FaceGlow`

First-party shirts are alternate skinned meshes on `nook-rig@1`. Hats, glasses, pins, backpacks, and props attach to named sockets. Cosmetics never change permissions or agent capability.

## Marketplace manifest

```json
{
  "schemaVersion": 1,
  "kind": "nook-avatar",
  "rigVersion": "nook-rig@1",
  "model": "orbit-v1.glb",
  "clips": {
    "idle": "idle",
    "listen": "listen",
    "think": "think",
    "walk": "walk",
    "drag": "drag",
    "wave": "wave",
    "success": "success",
    "sleep": "sleep",
    "error": "error"
  },
  "materials": {
    "primary": "MAT_Primary",
    "secondary": "MAT_Secondary",
    "faceGlow": "MAT_FaceGlow"
  },
  "sockets": [
    "socket_head",
    "socket_chest",
    "socket_back",
    "socket_hand_l",
    "socket_hand_r"
  ]
}
```

## Interaction contract

- Head click: short emotional reaction.
- Body click: action wheel with Talk, Dress, Teach, and Rest.
- Body drag: start after 4–6px; use pointer capture; clamp to safe viewport areas.
- Keyboard: Enter opens actions; arrow keys move 8px; Shift+arrow moves 24px.
- Speech bubble: HTML, anchored to the head, collision-aware, dismissible, two short lines maximum.
- Approval: playful motion pauses and the detailed decision remains ordinary accessible DOM.
- Dragging pauses autonomous walking and resumes from the new position.
- Reduced motion uses pose changes or a short opacity transition instead of walking/bobbing/parallax.

## Performance budget

- 15k–25k triangles; 35k hard ceiling.
- 20–35 deform bones; 45 hard ceiling.
- One 1024×1024 atlas or procedural materials.
- GLB target under 2MB; 4MB hard ceiling.
- At most two simultaneous live mascot canvases.
- Device pixel ratio capped at 1.5.
- No post-processing, physics, real-time shadow maps, or WebGPU dependency in v1.
- Suspend rendering when hidden/offscreen.
- Keep GLBs in static storage or R2, not the Worker server bundle.

## Validation gates

Reject creator uploads that exceed file, triangle, bone, texture, clip-duration, or socket limits; use external URIs; include cameras/lights that violate the runtime contract; or fail canonical re-export. Run conversion and validation in an isolated processing environment. Publish immutable signed revisions by content hash.

## Primary references

- [React Three Fiber performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [Three.js glTF guidance](https://threejs.org/manual/en/loading-3d-models.html)
- [Three.js animation system](https://threejs.org/manual/en/animation-system.html)
- [Blender glTF animation export](https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

