# Models and assets

Every model and asset the project loads or bundles, with its license. The project is MIT, so everything here must be compatible.

| Item | Used for | Source | License |
| --- | --- | --- | --- |
| Depth Anything V2 Small (`onnx-community/depth-anything-v2-small`) | Monocular depth | Hugging Face | Apache 2.0 |
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) | Hand tracking runtime | jsDelivr | Apache 2.0 |
| MediaPipe Hand Landmarker (float16) | Hand landmarks | Google storage | Apache 2.0 |
| Transformers.js (`@huggingface/transformers` 3.8) | Model runtime | npm (bundled); the PoC loads it from jsDelivr | Apache 2.0 |
| ONNX Runtime Web WASM (`ort-wasm-simd-threaded.jsep`) | Inference backend | Copied from Transformers.js into `ort/` at build | MIT |
| Fredoka font | Display type and counters | Google Fonts | SIL Open Font License 1.1 |
| Nunito font | UI and body text (design, from M1) | Google Fonts | SIL Open Font License 1.1 |
| App icon and Pompón illustration | Icons, onboarding | Original, `public/icon.svg` and `src/render/Pompon.tsx` | MIT (this project) |

Not allowed: Depth Anything V2 Base and Large (CC-BY-NC 4.0).

Creatures are drawn procedurally; there are no image or sound assets yet.
