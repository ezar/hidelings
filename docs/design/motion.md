# Motion specs

Creatures move with springs, UI moves with eases. With `prefers-reduced-motion`, every movement becomes a 200 ms fade, and nothing scales, bounces or shakes.

Tokens: durations fast 150, base 250, slow 450 ms. Ease out `cubic-bezier(0.22, 1, 0.36, 1)`. Creature spring stiffness 380, damping 22. UI spring stiffness 500, damping 34.

## Tuck-in (hiding phase), 900 ms

| Time | What happens |
| --- | --- |
| 0–300 ms | The creature appears at the tap point (scale 0 → 1, creature spring) and waves twice, arm ±20°. |
| 300–700 ms | Squashes to 85% height and slides 0.6 r towards the far side of the edge it hides behind. From here the occlusion shader decides what shows. |
| 700–900 ms | Settles with one small bob. |

Reduced motion: fades to hidden in 200 ms.

## Nearly found (seeking phase), 570 ms

Trigger: visible fraction above 40% and inside the central 40% of the screen for 250 ms (spec 6.2).

| Time | What happens |
| --- | --- |
| 0–250 ms | Dwell, nothing visible. |
| 250–370 ms | Eyes grow 30% with overshoot, pupils shrink. |
| 370–570 ms | "!" pops 0 → 1.1 → 1. A small chirp plays, panned by direction. |

Cooldown 4 s per creature. Reduced motion: the "!" appears without scaling.

## Catch, 950 ms

| Time | What happens |
| --- | --- |
| 0–120 ms | Squash to 1.25 × 0.75. Haptic 40 ms where available. |
| 120–260 ms | Stretch to 0.85 × 1.2 while rising 0.2 r. Happy eyes. |
| 260–450 ms | Pop: scale to 1.4 and fade out, 10 sparkles burst radially. Catch sound. |
| 450–950 ms | A small token flies along a curve to the counter (ease in-out). The counter bumps to 1.2 and back. |

Reduced motion: 200 ms fade and the counter number changes.

## Handover curtain, 500 ms + hold + 600 ms

| Time | What happens |
| --- | --- |
| 0–500 ms | Two panels close from the sides, ease out, 60 ms stagger. The valance sways twice. |
| Hold | The seeker holds "Ya lo tengo" for 600 ms; a ring fills around the button. Releasing early empties it. |
| 0–600 ms after the hold | The curtain lifts upwards, ease in-out. The timer starts on the first camera frame after it clears. |

Reduced motion: 200 ms crossfade both ways. The hold stays, because it stops the hider from skipping the curtain by accident.
