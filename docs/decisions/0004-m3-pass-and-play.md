# 0004: M3 pass-and-play

Date: 2026-09-25. Status: accepted, pending the family test.

## Context

M3 builds the core mode (spec 4.2): hide, hand over, seek, results, with three species and tap and pinch catching. Its acceptance is a parent and a child playing three rounds in a row without help.

## Decisions

- **Engine without rendering** (`src/engine/`): species data, game rules (catch at 12% visible, hide refused above 85% unless the hider taps the same spot again, nearly-found after 250 ms near the centre with a 4 s cooldown, Tímido's retreat, hint stages) and the round as pure transitions, all unit-tested. The UI keeps the round in a Zustand store and applies those transitions.
- **One camera stage per round**: the video, the Three.js overlay and the depth loop stay mounted through hiding, the curtain and seeking, so creatures and depth never reload between phases.
- **Hiding spots** are re-scanned about once a second from the latest depth map, only inside the part of the video on screen, and stored as world directions so the hints stay put when the phone turns. "Esconder por mí" follows the same 85% rule as the hider.
- **Hands**: MediaPipe runs on the main thread (it needs the video element). Its WASM is served from our origin and, like the model file, cached on first use rather than precached (about 12 MB the player may never need). When hands are on, the landmarker is loaded and warmed up behind the curtain, where the first-detection freeze from ADR 0001 is invisible.
- **Hints**: after 60 s without a catch, a chirp panned towards the nearest uncaught creature every 6 s; 20 s later an arrow at the screen edge as well. "Pista" shows the arrow for 5 s at once.
- **Sounds** are synthesized with Web Audio (no files); the context is unlocked in the "Empezar" tap.
- **Pause** stops the clock, hints and the time limit. The time limit is 5 minutes until the parent area sets it (M4).
- **Catch stills** are composed from the video and the WebGL canvas in the same frame the catch is drawn, and kept in memory only (spec 11).
- **Depth size benchmark**: the M1 iPhone measured 62 ms at 196 px, and the old rule (×1.65) picked 252. M0 showed 252 costs about 2.5 times 196 on that phone, so the rule now uses ×2.5 and keeps 196 there.

## Not in M3

- Contact shadows (spec 8.4) are still missing; creatures look fine without them in the mock tests, so they wait for the device check.
- Spatial sound beyond panning, the other three species, the collection and the parent area are M4.
