# 0007: M5a parallax and drift correction

Date: 2026-09-26. Status: accepted, pending the device check.

## Context

With 3DoF, creatures are fixed to a direction. When the seeker walks, the furniture shifts in the image but the creatures do not, so they slide (spec 8.5). M0 rated this acceptable until M5. Spec 17 asks for a translation estimate from optical flow and depth, so that one or two steps no longer make creatures slide noticeably.

## Options

1. **Global translation estimate**: sparse optical flow on the background plus the depth map gives a camera translation, and every anchor is shifted by it. This needs metric depth (Depth Anything V2 Small gives relative depth, rescaled every frame) and a solver that tolerates the gyroscope's own lag. Errors show up as all creatures swimming together.
2. **Per-anchor tracking** (chosen): each creature keeps a small image patch of what surrounds its anchor, which is where the depth edge it hides behind is. A few times a second the patch is searched for near where the gyroscope predicts the anchor, and a confident match moves the creature there. This follows exactly the thing that matters (the edge the creature hides behind) whatever the scale of the motion, and it corrects gyroscope drift too.

## Decisions

- About six times a second, the video is read at 160 px wide in grey. Each creature in view has a 15×15 px patch, searched by normalized cross-correlation within ±12 px of the prediction (about ±5° with the default field of view), with sub-pixel refinement.
- The patch is taken the first time the creature is well inside the frame (after its hide check). A match must score at least 0.9 to count; a score above 0.95 refreshes the patch so it keeps up as the viewpoint changes. Flat surfaces with no texture are not tracked.
- Corrections are smoothed (half the way, at most 1% of the frame per update). A creature never moves more than 20° from where it was hidden; beyond that the match is treated as wrong and a new patch is taken.
- The depth where the creature sits follows the matched point too, keeping its offset to the surface, so it stays behind the furniture as the seeker comes closer. Curioso keeps moving its own depth.
- Tracking pauses while the "slow down" card is up, and is reset when a round is replayed or a solo creature moves. `?notrack` turns it off for comparisons on the device.
- Unit tests check shifts with sub-pixel accuracy, brightness changes, flat surfaces and missing patches on synthetic frames.

## Risks

- Strong rotation of the phone around the viewing axis changes the patch's appearance; the match then fails and the creature stays on the gyroscope's prediction, as before.
- Repeated textures (tiles, books) could match the wrong copy. The 0.9 threshold, the small search window and the 20° cap limit the damage.
