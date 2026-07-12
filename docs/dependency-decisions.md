# Dependency decisions

No package was added for the supervised MVP. Existing Zod, OpenAI Agents SDK, Supabase clients, React Three Fiber, Three.js, and Web Crypto cover the slice. Avoiding another workflow, URL, state-machine, or animation library keeps the effect boundary inspectable.

Current build versions are recorded in `package.json`. The baseline npm audit reported 16 advisories (1 low, 11 moderate, 4 high); no forced upgrade was applied because it could silently cross the experimental Vinext/Next/React compatibility boundary. Each direct dependency and advisory path must be reviewed in a focused maintenance change.

The production build requires modern `node:fs/promises.glob`; the machine's Node 20 launcher fails before Vinext starts. Validation therefore uses the bundled Node 24 runtime. The repository should add an enforced Node engine/toolchain file in a separate compatibility PR after CI behavior is confirmed.
