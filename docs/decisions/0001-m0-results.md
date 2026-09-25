# 0001: M0 results, go with 196 px depth

Date: 2026-09-25. Status: accepted.

## Context

M0 asks whether iPhone Safari, without WebXR, can make creatures convincingly hide behind real furniture (spec section 17). The PoC in `poc/` was run on an iPhone (Safari and Edge, both WebKit, WebGPU with `shader-f16`) on 2026-09-25, with the timing breakdown added in PR #3.

## Measurements

Depth Anything V2 Small, fp16 on WebGPU. Medians unless noted.

| Input size | Depth fps | Model ms | Full loop ms | Notes |
| --- | --- | --- | --- | --- |
| 196 | 7.5–7.9 | 97 (p90 117) | 117 (p90 138) | Clean 2-minute run, hands on for part of it |
| 252 | 3.7 | ~248 per frame | – | First run, before the breakdown existed |
| 364 | 1.7 | up to 1529 | up to 1591 | Unusable |

- The model is about 95% of each depth frame. Capture (5 ms), preprocessing (4 ms) and postprocessing (1 ms) are negligible, so a worker will not make depth itself faster; input size is the lever.
- Hands plus depth at 196: depth stays at 7.5 fps, hand detection 10 ms median (p90 25). Target of 6 fps met.
- Gyroscope at 196: 62 events/s, longest gap per second 34 ms median (p90 65). At 364 it fell to 13 events/s with gaps of 0.8–3 s, so heavy depth starves the main thread.
- The first hand detection froze the page for about 8 s (depth loop, gyroscope and hands all stalled together). One-off GPU warm-up of MediaPipe.
- Rendering: 2–4 ms per frame median.
- Occlusion: catches at 13–20% visible happened often, so creatures really are partly covered.
- Automatic hiding spots: 0 to 5 per attempt, strongly dependent on where the phone points.
- Model load: 0.5–0.7 s from cache, 3.8 s on a cold cache in a new browser.

Player impressions (standing and turning, one room):

| Question | Answer |
| --- | --- |
| Do creatures flicker? | Sometimes |
| Does a hand cover them cleanly? | Yes |
| Do they stay put over several minutes? | No, they drift |
| Does walking a step or two break the illusion? | A little |
| Do automatic hiding spots look natural? | Yes |
| Does the phone get warm? | A little |

## Decision

**Go.** The core illusion works on the iPhone in the browser: occlusion hides creatures convincingly, hands pass in front of them, and pinch-to-catch works with depth still near target.

- Depth input size: **196 px** by default. 252 only as an option for fast devices after a benchmark at first launch (spec 7.1); 308 and 364 are removed from the default choices.
- Parallax: **acceptable for M1–M4.** Walking a step or two breaks the illusion only a little. Keep the design mitigation of spec 8.5 (stand and turn, creatures close to the far surface) and leave translation estimation for M5.

## Consequences

Carried into later milestones:

- **Yaw drift is real** (creatures move over minutes). M1 adds a drift measurement to the debug report (angle between a creature's anchor and the same image feature over time). If drift exceeds a few degrees in five minutes, periodic re-anchoring to image features moves forward from M5 to M2.
- **Flicker "sometimes"**: M2's temporal smoothing (EMA of the normalization range, blending with the previous warped map) is required, not optional. M2's acceptance of under 5% flicker frames stands.
- **Depth runs in a Web Worker in M1**, to keep the gyroscope and rendering on a free main thread even when the model is slow.
- **Warm up MediaPipe hands during loading**, behind the progress screen, never mid-game.
- **Automatic spots vary a lot by view**: solo mode's scan (collecting spots across directions) is the right answer; the hiding phase should show spot hints only when some exist.
- **Thermal**: a little warm after a short session. Measure again over 10 minutes in M4 (spec 14).
- PoC bugs not worth fixing in `poc/`: the seek timer does not reset when hiding again without leaving seek mode, and Safari logs "The string did not match the expected pattern" twice at start-up.
