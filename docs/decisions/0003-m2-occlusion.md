# 0003: M2 occlusion renderer and calibration

Date: 2026-09-25. Status: accepted, pending the iPhone check.

## Context

M2 turns the PoC's 2D per-pixel masking into a Three.js overlay with a 3D creature (spec 8.4), adds temporal smoothing (7.1) and the field-of-view calibration (8.3). M2 was started before M1's iPhone check, at the owner's request, so both milestones are checked on the device together.

## Decisions

- **Camera**: the Three.js camera takes the device orientation as its rotation and the video's vertical field of view, with `setViewOffset` reproducing the `object-fit: cover` crop. A unit test checks that it puts an anchored point on the same pixel as `rotation.ts` and `viewMapping.ts`, which occlusion depends on.
- **Anchors**: creatures sit 3 units from the player along their world direction. 3DoF has no metric depth, so the distance only sets the scale; size follows relative depth as in the PoC.
- **Occlusion shader**: every creature material reads an 8-bit single-channel depth texture with linear filtering (1/255 steps are finer than the 0.04 margin), shifts the lookup by the rotation since the depth frame, and fades with a 0.03 soft edge. 8-bit avoids float-texture filtering differences between GPUs.
- **Visibility read-back**: one creature per frame is rendered into a 48-pixel-wide target that stores occlusion and coverage, then read back and averaged. With five creatures each is measured about 12 times a second, enough for the catch rule (12%) and the flicker metric.
- **Temporal smoothing**: the worker smooths the normalization range with an EMA (α 0.25); the main thread blends each map with the previous one warped by the rotation between them (35% old), skipping the blend after turns of more than 12°.
- **Flicker metric**: share of visibility samples whose visible fraction jumps by more than 30% (spec 15), shown live in the lab and in the report. M2's acceptance asks for under 5%.
- **Calibration**: instead of optical flow on a grid, a global shift between two low-resolution frames (sum of absolute differences, ±14 px horizontally, ±4 vertically, sub-pixel parabola) is compared with the gyroscope rotation between them. The median of at least six estimates, with turns seen to both sides, becomes the field of view. A slider is the fallback. Simpler than a flow grid and enough for a single number.
- **Not in M2**: contact shadows (spec 8.4) move to M3 with the hiding phase, where creatures sit against real surfaces.

## Consequences

- The lab (`src/features/lab/Lab.tsx`) is the M2 test bench: tap behind furniture to hide Pompón, turn slowly, read "Visible" and "parpadeo".
- The first start now goes through calibration. "Saltar" keeps 64° and does not ask again; "Calibrar" in Ajustes repeats it.
