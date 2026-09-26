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
- M1 (foundations): measured on the iPhone (2026-09-25): depth in the worker at 9.4 fps at 196 px, gyroscope at 60 events/s with gaps under 30 ms. Still to check: an offline reload. See [`docs/decisions/0002-m1-runtime.md`](docs/decisions/0002-m1-runtime.md).
- M2 (occlusion renderer): built before M1's device check, at the owner's request. Acceptance: Pompón behind a sofa edge shows a clean, stable partial silhouette while turning slowly, with flicker under 5% (shown in the lab). See [`docs/decisions/0003-m2-occlusion.md`](docs/decisions/0003-m2-occlusion.md).
- M3 (pass-and-play): built, also at the owner's request before M2's device check. Acceptance: a parent and a child complete three rounds in a row without help. See [`docs/decisions/0004-m3-pass-and-play.md`](docs/decisions/0004-m3-pass-and-play.md).
- M4a (six species, collection, parent area, safety): built without waiting for device checks, at the owner's request. See [`docs/decisions/0005-m4-collection-parent-safety.md`](docs/decisions/0005-m4-collection-parent-safety.md).
- M4b (solo mode, room scan, moving creatures, rare species, spatial sound): built, same way. Acceptance: a solo round across a whole room works and Brillo appears in a dark room. See [`docs/decisions/0006-m4-solo.md`](docs/decisions/0006-m4-solo.md).
- M5a (parallax and drift: per-anchor image tracking): built, same way. Acceptance: walking one or two steps no longer makes creatures slide noticeably on the iPhone; compare with `?notrack`. See [`docs/decisions/0007-m5-parallax.md`](docs/decisions/0007-m5-parallax.md).
- M5b (Android WebXR, AR Quick Look): next.

## Commands

- `npm run check`: typecheck, lint and unit tests. Run before every push.
- `npm run dev`, then open `/hidelings/?mock` to work without the depth model.
