# Models and assets

Every model and asset the project loads or bundles, with its license. The project is MIT, so everything here must be compatible.

| Item | Used for | Source | License |
| --- | --- | --- | --- |
| Depth Anything V2 Small (`onnx-community/depth-anything-v2-small`) | Monocular depth | Hugging Face | Apache 2.0 |
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision` 1.0) | Hand tracking runtime | npm; WASM copied into `mediapipe/` at build (the PoC loads it from jsDelivr) | Apache 2.0 |
| MediaPipe Hand Landmarker (float16) | Hand landmarks | Google storage | Apache 2.0 |
| Transformers.js (`@huggingface/transformers` 3.8) | Model runtime | npm (bundled); the PoC loads it from jsDelivr | Apache 2.0 |
| ONNX Runtime Web WASM (`ort-wasm-simd-threaded.jsep`) | Inference backend | Copied from Transformers.js into `ort/` at build | MIT |
| Three.js | 3D creatures and occlusion shader | npm (bundled) | MIT |
| Fredoka font | Display type and counters | Google Fonts | SIL Open Font License 1.1 |
| Nunito font | UI and body text (design, from M1) | Google Fonts | SIL Open Font License 1.1 |
| App icon and creatures (all six species) | Icons, menus, collection, creatures | Original, built in code: `public/icon.svg`, `src/render/Pompon.tsx`, `src/render/Creature2D.tsx`, `src/render/creatures3d.ts` | MIT (this project) |
| Dexie (4.x) | Collection storage in IndexedDB | npm (bundled) | Apache 2.0 |
| Sounds | Hints, reactions, catches | Synthesized with Web Audio in `src/audio/audio.ts` | MIT (this project) |

Not allowed: Depth Anything V2 Base and Large (CC-BY-NC 4.0).

Creatures and sounds are generated in code; there are no image or audio files.
