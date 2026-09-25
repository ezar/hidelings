# Hidelings

Hide-and-seek with little creatures that hide behind the real things in your house.

Hidelings is a browser game for families. One player hides a handful of creatures around a room by tapping just behind a sofa, a door frame or a stack of books. Another player takes the phone and searches for them. The creatures only show what the real furniture does not cover: an ear behind the cushion, two eyes over the edge of the table. When one peeks out, you catch it with a tap or by pinching it with your fingers in front of the camera. In solo mode, the game hides them itself by reading the room.

It works in Safari on the iPhone without WebXR. The illusion comes from three things running locally in the browser:

- **Monocular depth estimation** (Depth Anything V2 Small): tells, pixel by pixel, whether the real scene is in front of or behind each creature.
- **The gyroscope**: keeps each creature anchored in space when you turn the phone.
- **Hand tracking** (MediaPipe): lets you catch creatures with a pinch, and makes your real hand pass in front of them.

Everything runs on the family's devices. No image leaves the phone.

Name: Hidelings. Repository: `hidelings`. Alternatives if the name is taken: `peekaboos`, `hidelings-game`.

License: MIT suggested. Every bundled model and asset must have a compatible license (section 7.4).

---

## 0. How to use this document

For Claude Code:

- Read the whole document before writing code. Store it as `docs/spec.md` and reference it from `CLAUDE.md`.
- A working proof of concept lives in `poc/` (plain ES modules, no build). It validates the core technique: depth-based occlusion, gyroscope anchoring with rotation compensation, automatic hiding spots, and pinch-to-catch. Use it as the reference for the algorithms and the APIs. Where this document and the PoC disagree, this document wins.
- Work milestone by milestone (section 17). Do not start a milestone until the previous one meets its acceptance criteria.
- All code, comments, identifiers, commit messages and in-repo docs in English. UI in Spanish and English from the first milestone with UI.
- Model names are candidates. When a model or API does not behave as described, stop and propose options. Record decisions as short ADRs in `docs/decisions/`.

For Claude Design:

- Run the design brief in section 18 before M1. Save outputs in `docs/design/`.

---

## 1. Vision and pillars

1. **The house is the playground.** Real furniture is the level design. The same living room plays differently every time because the creatures use what is actually there.
2. **Peeking is the magic.** A creature half-hidden behind a real object is the moment that makes people gasp. Every technical decision serves that moment: stable occlusion, soft edges, creatures that react to being almost seen.
3. **Play together.** Pass-and-play between parent and kids is the core mode. Solo mode exists, but the game is at its best with two people and one phone.
4. **Instant start.** From opening the app to the first creature peeking out: under one minute on a warm cache.
5. **Private and safe by construction.** Local models, no accounts, no uploads. The game never asks players to climb, run or move fast.

What makes it different: marker-based AR needs printed targets, and WebXR does not exist on iOS. Hidelings uses AI depth estimation to get real occlusion on an iPhone in the browser, and uses the same depth map to choose hiding spots automatically. No existing game does either.

---

## 2. Users, devices and constraints

Users: children from about 5 to 12 and their parents, playing at home.

Devices, in priority order:

1. iPhone with Safari, portrait. Primary target. No WebXR. WebGPU preferred, WASM fallback required.
2. Android with Chrome. Same experience; optionally enhanced with WebXR (section 9.4).
3. Desktop browsers: development only. Without a gyroscope the creatures stay fixed on screen.

Hard constraints:

- Fully playable on an iPhone in the browser, with no native app and no server.
- Installable PWA; works offline once models are cached.
- On iOS every browser uses WebKit, so Chrome on iOS has the same limits as Safari. Do not rely on WebXR, ImageCapture or camera exposure control.
- DeviceOrientation requires a permission prompt on iOS triggered by a user gesture. It must be the first async call in that gesture's handler.
- Stack: React + TypeScript + Vite + Zustand + Framer Motion for the UI, Three.js for rendering, deployed as a static site to GitHub Pages or Vercel.

---

## 3. Core concepts

- **Session**: one game. Has a mode, a room, a set of creatures, a hider and a seeker, a timer and a result.
- **Room**: a place where a session happens. It stores nothing visual; only a name, the best field-of-view calibration for that phone, and statistics.
- **Creature**: a hideling instance in a session. It has a species, an anchor (a world direction plus a relative depth), a state, and a visibility value computed every frame.
- **Species**: a creature type with its own look, size, colour range, sounds and behaviour (section 6).
- **Anchor**: where a creature lives. In 3DoF mode, a unit direction in the world frame from the gyroscope plus a relative inverse depth. In 6DoF modes (section 9), a 3D point.
- **Hiding spot**: a candidate location found in the depth map where a far surface sits right next to a much nearer object.
- **Collection**: the family's bestiary of species caught so far, with first-catch dates and counts.

---

## 4. Experience

### 4.1 First launch

1. Welcome screen with the game's promise in one sentence and a single "Empezar" button.
2. The tap triggers, in this order: motion permission, camera permission, device probe, model download with honest size and progress.
3. A 20-second calibration: "Apunta a una puerta y gira despacio a los lados". The game adjusts the field of view until a test creature stays glued to the door frame (section 8.3). Result saved per device.
4. First game suggestion: "Esconde 3 criaturas para que alguien las encuentre".

### 4.2 Pass-and-play hide and seek (core mode)

**Hiding phase**

- Live camera with a gentle overlay showing where good hiding spots are: small shimmering dots on the far side of object edges, taken from the automatic spot finder.
- Tap anywhere to hide a creature there; tapping near a suggested spot snaps to it. The creature waves, then tucks itself behind the object.
- "Esconder por mí" places the chosen number automatically in the current view.
- The hider can pan around the room to hide creatures in different directions.
- A "Listo, pasa el móvil" screen blocks the camera view while the phone changes hands, so the seeker does not see where the creatures went.

**Seeking phase**

- Timer starts on the first frame the seeker sees.
- Creatures show only their unoccluded parts. They react to being nearly found (section 6.2).
- Catch by tapping a visible part or pinching it with the fingers. A catch needs at least a small visible fraction, so tapping blindly on a sofa does nothing.
- Hints after a configurable delay: a faint sound from the creature's direction (stereo panning), then an arrow at the screen edge.
- Result screen: time, creatures caught, the hardest one to find (least visible when caught), and a replay of each catch moment as a still with the creature highlighted.

### 4.3 Solo mode

- The game hides the creatures itself around the player: it asks them to slowly look around the room first ("Enséñame la habitación"), collects hiding spots in every direction, then hides creatures behind the best ones.
- Creatures may move between hiding spots during the round (only in solo mode, only between spots the game has seen).
- Difficulty: number of creatures, how much of them peeks out, whether they move.

### 4.4 Collection

- A bestiary with every species, shown as silhouettes until caught.
- Each species card: name, look, behaviour description, number caught, first catch date and room.
- Rare species appear only under certain conditions: in dark rooms, behind plants, late in the day, after many catches. The conditions are hinted but never spelled out.

### 4.5 Parent area

- Behind a simple gate.
- Session length limit, hint delays, whether solo creatures can move, sound on or off.
- Storage and model management, calibration reset, delete collection.

---

## 5. Game rules

- A creature is caught when the tap or pinch point falls within its catch radius and its visible fraction is at least 12%.
- Creatures cannot be hidden where they would be fully visible from the hiding viewpoint (visible fraction above 85%) unless the hider insists with a second tap. This keeps the game a game.
- A creature whose anchor falls off the estimated scene (depth unavailable, pointing at the sky through a window) stays hidden until depth is available again.
- A round ends when all creatures are caught, or when the time limit expires; uncaught creatures then wave from their hiding spots.

---

## 6. Creatures

### 6.1 Species (initial set, all original)

- **Pompón**: round and fuzzy, the default species. Peeks with its eyes over edges.
- **Fideo**: long and thin, hides behind table legs and door frames, peeks sideways.
- **Tímido**: tiny, pulls back if it is more than half visible for too long.
- **Curioso**: moves slightly towards the seeker when not looked at directly.
- **Dormilón**: sleeps; visible Zzz particles give it away; hides in darker areas.
- **Brillo** (rare): glows softly; only appears in dark rooms and is easier to spot there.

Species are data-driven: look parameters, size range, preferred hiding spot type (horizontal edge, vertical edge, dark area), behaviour parameters and sounds.

### 6.2 Behaviour

- Idle animation: breathing, blinking, looking around.
- Peek cycle: creatures slowly shift within a small range around their anchor, so what peeks out changes over time.
- Nearly found: when a creature is near the centre of the screen and more than 40% visible, it reacts (eyes widen, a small sound), which is both a hint and a moment of delight.
- Caught: a squash-and-stretch pop, a burst of particles, a happy sound, and it flies to the collection counter.

### 6.3 Look

- 3D, stylized, soft shapes with big eyes. Built in code (procedural geometry and shaders) or as small glTF files authored for the project. No licensed characters.
- Fur-like rim lighting and a soft contact shadow faked from the depth map to make them sit in the scene.
- Colour variations per instance within the species palette.

---

## 7. Perception and AI

### 7.1 Depth

- Model: Depth Anything V2 Small, ONNX, through Transformers.js. WebGPU with fp16 when `shader-f16` is available, fp32 otherwise, `q8` on WASM.
- Input: the camera frame downscaled, resized by the processor to a square of 196, 252, 308 or 364 pixels (multiples of 14). Default 252; chosen per device by a short benchmark at first launch and adjustable in settings.
- Output: relative inverse depth. Normalize each frame to 0 (far) .. 1 (near) using the 2nd and 98th percentiles.
- Temporal stability (new versus the PoC):
  - Smooth the normalization range with an exponential moving average so a bright object entering the frame does not rescale everything.
  - Optionally blend each new map with the previous one warped by the rotation since then, to reduce flicker at edges.
- Run in a Web Worker. The render loop always uses the latest completed map together with the device orientation captured when its frame was grabbed.

### 7.2 Hiding spot finder

- Sample points in the central area of the depth map. A point is a candidate when it is relatively far (below 0.75) and there is a much nearer surface (at least 0.18 nearer) within about 4% of the map width in some direction.
- Score by depth difference; keep the best with a minimum separation.
- Classify each spot by the direction of its nearer neighbour (horizontal edge: something in front below or above; vertical edge: something in front to the side) so species can pick the spots they like.
- Solo mode accumulates spots across many frames and directions, merging spots whose world directions are within a few degrees.

### 7.3 Hands

- MediaPipe Hand Landmarker (tasks-vision), GPU delegate, VIDEO mode, up to two hands.
- Pinch: thumb tip to index tip distance below 6% of the shorter screen side. A catch fires on the pinch start.
- Run every second frame, and only in the seeking phase with hands enabled. Measure the combined load with depth on the iPhone in M0.

### 7.4 Licenses

- Depth Anything V2 Small is Apache 2.0. The Base and Large variants are CC-BY-NC 4.0 and must not be used if the project is MIT.
- MediaPipe Tasks and the hand landmarker model are Apache 2.0.
- Sounds CC0 or original. Creature models original.
- Record every model and asset with its license in `docs/models.md`.

---

## 8. Anchoring and rendering

### 8.1 Coordinate frames

- Device frame: x to the right of the screen, y to the top, z out of the screen towards the user. The rear camera looks along -z.
- World frame from DeviceOrientation: R = Rz(alpha) · Rx(beta) · Ry(gamma), mapping device to world.
- Portrait only. Landscape shows a friendly "gira el móvil" screen.
- The PoC's `orientation.js` is tested and correct for these conventions (turning left moves anchored content right on screen; tilting up moves it down). Port it with unit tests.

### 8.2 Projection

- Pixel to ray: `[(2u - 1)·tanX, (1 - 2v)·tanY, -1]` in the device frame, where `tanX` and `tanY` come from the calibrated field of view and the video aspect.
- Ray to world: multiply by R at the time of the tap (for manual hiding) or at the time the depth frame was captured (for automatic spots).
- World to screen: multiply by Rᵀ, then perspective divide.
- The video is displayed with `object-fit: cover`; all mapping between normalized video coordinates and screen pixels goes through one `ViewMapping` helper.

### 8.3 Field-of-view calibration

- Default: 64° on the long side of the video.
- The calibration step places a test creature at a visually salient edge, asks the player to rotate slowly, measures how far the edge moves in the image (optical flow on a small grid) against how far the creature moves by projection, and solves for the field of view. Manual slider as fallback.

### 8.4 Occlusion rendering

- Three.js renders creatures in a transparent WebGL canvas over the video element.
- The latest depth map is uploaded as a texture. The creature fragment shader computes the screen position, shifts the lookup by the rotation compensation offset (the difference between the creature's current projection and its projection with the depth frame's orientation), samples scene depth and fades the fragment out with a soft edge where the scene is nearer than the creature plus a margin.
- The shader writes a visibility contribution to a small render target; the CPU reads back a downsampled version to get each creature's visible fraction for game rules.
- Creature size scales with its relative depth. Contact shadows are faked by darkening the video slightly below the creature where scene depth matches the creature's depth.

### 8.5 Parallax: the known limit and the plan

- 3DoF tracks rotation only. When the seeker walks, real objects shift in the image but creatures do not, and they slide.
- M0 decides how much this matters for play.
- Mitigation path, in order:
  1. Design: encourage standing and turning (the seeker's UI suggests "mira alrededor"), and keep creatures near the far surface they hide against, where parallax is smallest.
  2. Translation estimate: sparse optical flow on the background plus the depth map to estimate camera translation, and shift anchors accordingly (visual odometry lite).
  3. On Android, WebXR `immersive-ar` gives full 6DoF (section 9.4).

---

## 9. Platform paths

### 9.1 iPhone Safari (primary)

Everything above. The whole game must be great here.

### 9.2 Android Chrome

Same 3DoF pipeline by default.

### 9.3 Desktop

Development only: fixed camera, mouse to hide and catch, depth and occlusion fully working. Useful with a laptop webcam and a recorded video source for tests.

### 9.4 WebXR enhancement (optional, Android)

When `immersive-ar` is available, use hit-test and anchors for 6DoF placement, and the WebXR depth-sensing module when supported; fall back to Depth Anything otherwise. Out of scope before M5.

### 9.5 AR Quick Look (optional)

From the collection, view a caught species full size in the room through AR Quick Look on iOS (USDZ export of the creature model). A delightful extra, not a core feature.

---

## 10. Sound

- Each species has a small set of sounds: idle chirps, nearly-found reaction, catch.
- Hints use stereo panning by the creature's horizontal angle relative to the phone.
- Web Audio, with a short tap-to-enable step on iOS. Volume and mute in settings.

---

## 11. Data and storage

- Collection, settings, calibrations and statistics in IndexedDB (Dexie).
- No images or video are stored. The catch replay stills are kept in memory for the result screen only, unless the parent enables saving them.
- Export and import of the collection as a JSON file.

---

## 12. Safety

- The seeker's UI encourages standing and turning, never running.
- If the gyroscope shows fast movement while walking, overlays fade and a gentle "más despacio" appears.
- No quests or hints ever point up at shelves, out of windows or into other rooms; solo mode only uses spots seen in the current session.
- Session length limit set by the parent.

---

## 13. Tech stack and structure

- React, TypeScript strict, Vite, Zustand, Framer Motion, Three.js.
- Transformers.js for depth, MediaPipe tasks-vision for hands, both in workers where the library allows it (MediaPipe may need the main thread with a `VideoFrame` or `ImageBitmap` handoff; verify in M0).
- PWA with vite-plugin-pwa; models cached with explicit versioning.
- Tests: Vitest for maths, game rules and spot finding; Playwright with fake camera streams and a mocked depth worker for flows; golden depth maps from recorded rooms for regression.
- CI: typecheck, lint, test, build, deploy.

```
src/
  app/            routes, shell, providers, permissions flow
  features/
    onboarding/   welcome, permissions, model download, calibration
    hide/         hiding phase, spot hints, handover screen
    seek/         seeking phase, hints, catching, results
    solo/         room scan, auto hiding, moving creatures
    collection/   bestiary, species cards
    parent/       settings, storage, limits
  engine/         session state machine, game rules, species behaviours (no rendering, no AI)
  perception/
    depth/        worker, normalization, temporal smoothing
    spots/        hiding spot finder and classifier
    hands/        landmarker wrapper, pinch detection
    motion/       device orientation, calibration, translation estimate
  render/         three.js scene, creature models, occlusion shader, particles
  audio/          sounds, spatial hints
  data/           dexie db, export and import
  i18n/
poc/              reference proof of concept
docs/
```

---

## 14. Performance targets (iPhone)

- Camera preview and rendering: 60 fps; never below 30 fps.
- Depth: 8 fps or more at 252 px on WebGPU; 4 fps minimum on WASM.
- Hands plus depth together: depth still at 6 fps or more.
- From "Empezar" to first creature with models cached: under 10 seconds.
- First model download: show size before downloading; target under 60 MB for depth and hands together.
- 10-minute session without thermal throttling warnings; measure in M0 and M4.

---

## 15. Testing

- Unit tests: orientation maths and projections (including the PoC's known cases), view mapping, normalization and smoothing, spot finder on synthetic depth maps, visibility thresholds, game rules, species behaviours.
- Regression: recorded room videos with precomputed depth maps; measure spot quality and occlusion flicker (fraction of frames where a creature's visibility jumps by more than 30%).
- Manual protocol per milestone on the iPhone, as in the PoC README.

---

## 16. Analytics and privacy

- No third-party analytics. A local debug overlay and a copyable JSON report with timings, as in the PoC.

---

## 17. Milestones

**M0: Feasibility on the real iPhone (PoC in `poc/`)**
- Run the PoC protocol. Measure depth fps per resolution, with and without hands; gyroscope drift over five minutes; occlusion flicker; quality of automatic spots in three rooms; how much walking breaks the illusion.
- Acceptance: go or no-go written in `docs/decisions/0001-m0-results.md`, with the chosen depth resolution and the verdict on parallax.

**M1: Foundations**
- Repo scaffold, PWA, i18n, permissions flow, device probe, depth worker, orientation module with tests, view mapping, model manager, CI.
- Acceptance: on the iPhone, the depth preview runs in the new app at M0's fps and survives an offline reload.

**M2: Occlusion renderer**
- Three.js overlay, occlusion shader with rotation compensation, visibility read-back, one creature species, calibration flow, temporal smoothing.
- Acceptance: a creature behind a sofa edge shows a clean, stable partial silhouette while the phone turns slowly; flicker below 5% of frames.

**M3: Pass-and-play**
- Hiding phase with spot hints, handover screen, seeking phase, tap and pinch catching, hints, results screen, three species.
- Acceptance: a parent and a child complete three rounds in a row without help.

**M4: Solo, collection and sound**
- Room scan, auto hiding across directions, moving creatures, all six species, bestiary, rare species conditions, spatial sound hints.
- Acceptance: a solo round across a whole room works and rare species appear under their conditions.

**M5: Parallax and platforms**
- Translation estimate from optical flow and depth; Android WebXR path; optional AR Quick Look from the collection.
- Acceptance: walking one or two steps no longer makes creatures slide noticeably on iPhone; Android with WebXR anchors creatures in 6DoF.

---

## 18. Design brief (for Claude Design)

Product: a hide-and-seek game where cute original creatures hide behind the real furniture of your house, seen through the phone's camera.

Mood: playful, soft and a little mischievous. The creatures are the stars; the interface stays out of the way of the camera. Think of a children's picture book about tiny house spirits, with bright, friendly colours and chunky, rounded shapes.

Design these:

1. **Creature species**: six original characters (section 6.1) as turnaround sheets with expressions: idle, peeking, nearly found, caught. They must read clearly when only a third of them is visible.
2. **Welcome and permissions**: one screen that explains camera and motion access in plain language, and the model download with a charming wait.
3. **Calibration**: a short, guided, fun step (the door frame test).
4. **Hiding phase**: camera view, shimmering spot hints, the tuck-in animation, the counter, "Esconder por mí".
5. **Handover screen**: a playful curtain that hides the camera while the phone changes hands.
6. **Seeking phase**: minimal HUD over the camera, timer, found counter, edge hints, pinch feedback, catch celebration.
7. **Results**: time, creatures found, the hardest catch, replay stills.
8. **Collection**: bestiary with silhouettes, species cards, rare species teasers.
9. **Parent area**: plain, calm, clearly separate from the game look.

Constraints: portrait, one-hand use, large touch targets for small children, HUD readable over any camera image, Spanish and English text lengths, reduced-motion support. Original identity only; no references to existing franchises.

Deliver: tokens (colour, type, spacing, radius, motion), creature sheets, component inventory, key screens, and motion specs for tuck-in, nearly found, catch and the handover curtain.

---

## 19. Risks and open questions

- **Parallax when walking** (section 8.5): the main risk to the illusion. M0 measures it; M5 addresses it.
- **Relative depth instability**: per-frame normalization may make creatures flicker. Mitigated by smoothing the range and temporal blending in M2.
- **Gyroscope yaw drift on iOS**: alpha is relative and may drift over minutes. Mitigate with periodic re-anchoring to image features in M5 if M0 shows drift above a few degrees in five minutes.
- **Thermal load** from depth and hands together on the iPhone: adaptive resolution and frame skipping.
- **Rooms with few edges** (empty walls): solo mode asks the player to point at furniture; spot hints show where hiding works.
- Open: multi-phone play where the hider uses one phone and seekers use others. Needs shared anchors, which 3DoF cannot give; revisit after M5.

---

## 20. Non-goals

- No persistent maps of the house and no stored images of it.
- No accounts, cloud AI, ads or purchases.
- No licensed characters.
- No native app in scope; a Capacitor wrapper with ARKit is a possible future path, not part of this spec.
