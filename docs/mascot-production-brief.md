# Original Nook mascot production brief

Create one cozy, compact desktop companion with a recognizable cloud/hood silhouette, dark face screen, expressive emissive eyes, small hands/feet, and clothing-friendly proportions. It must read clearly at 96 px without resembling an existing franchise.

Deliver a glTF 2.0 `.glb` with one armature, stable bone names, applied transforms, meters, +Y up, +Z forward, skin weights capped at four influences, no hidden geometry, and separate body/face/outfit/accessory material slots. Target under 2 MB compressed, under 35k triangles base, 2k textures maximum, sensible mobile fallback, and no external texture paths.

Required clips: `idle`, `listen`, `think`, `delegate`, `walk`, `approval`, `success`, `failure`, `drag`, `sleep`. Clips loop only when appropriate, start/end in compatible neutral poses, use root-in-place motion for web, and avoid movement that blocks OS controls. The animation manifest maps durable server states to clips and crossfade durations. `approval` stops travel and faces the user; `offline` sleeps and never appears busy.

Wardrobe contract: versioned rig ID; named attachment bones; deformation test for hoodie/varsity/utility silhouettes; no capability metadata in cosmetic manifests. Validate with Khronos glTF Validator, Blender export inspection, Three.js GLTFLoader/AnimationMixer, reduced-motion fallback, color contrast, keyboard controls, WebGL loss, and representative low-end GPU profiling.
