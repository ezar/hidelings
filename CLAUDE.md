# Hidelings

Browser hide-and-seek game: creatures hide behind real furniture seen through the phone camera. The full specification is in [`docs/spec.md`](docs/spec.md). Read it before writing code.

## Rules

- Work milestone by milestone (spec section 17). Do not start a milestone until the previous one meets its acceptance criteria.
- `poc/` is the reference proof of concept (plain ES modules, no build). Use it for algorithms and APIs. Where the spec and the PoC disagree, the spec wins. Do not refactor `poc/`.
- Code, comments, identifiers, commit messages and in-repo docs in English. UI text in Spanish and English.
- Model names in the spec are candidates. If a model or API does not behave as described, stop and propose options.
- Record decisions as short ADRs in [`docs/decisions/`](docs/decisions/).
- Record every model and asset with its license in [`docs/models.md`](docs/models.md). The project is MIT: never use Depth Anything V2 Base or Large (CC-BY-NC 4.0).
- Primary target is iPhone Safari in portrait, without WebXR. Do not rely on WebXR, ImageCapture or camera exposure control there.
- On iOS, the DeviceOrientation permission request must be the first async call in the tap handler.

## Status

- Design brief (spec section 18): done, see [`docs/design/`](docs/design/). Use its tokens and components in M1.
- M0 (feasibility on the iPhone): done. Go, depth at 196 px, parallax acceptable until M5. See [`docs/decisions/0001-m0-results.md`](docs/decisions/0001-m0-results.md) for what carries into later milestones.
- M1 (foundations): built, waiting for the iPhone check. Acceptance: the depth preview runs at M0's fps (about 8 fps at 196 px) and survives an offline reload. See [`docs/decisions/0002-m1-runtime.md`](docs/decisions/0002-m1-runtime.md).
- M2 (occlusion renderer): built before M1's device check, at the owner's request; both are checked on the iPhone together. Acceptance: Pompón behind a sofa edge shows a clean, stable partial silhouette while turning slowly, with flicker under 5% (shown in the lab). See [`docs/decisions/0003-m2-occlusion.md`](docs/decisions/0003-m2-occlusion.md).
- M3 (pass-and-play): next, once M1 and M2 pass on the iPhone.

## Commands

- `npm run check`: typecheck, lint and unit tests. Run before every push.
- `npm run dev`, then open `/hidelings/?mock` to work without the depth model.
