# Design (M1 input)

Output of the design brief in spec section 18.

The interactive canvas: https://claude.ai/artifact/PmBR4FXP4sT9UAu6Usqgie (private to the owner until shared from its Share menu). Its artboard sources are copied in [`canvas/`](canvas/); they use the canvas runtime (`support.js`) and do not open on their own.

## Direction

A picture book about tiny house spirits. Warm paper, deep plum ink, honey for every action. Creatures have a thick ink outline, flat body colour and big eyes set high, so a third of a creature is enough to recognise it. The interface stays at the top and bottom edges; the middle of the camera is for the creatures.

- Type: Fredoka for display and counters, Nunito for everything else. Both are SIL OFL.
- Over the camera: glass pills (dark plum at 74%) with white text, honey for the counter and the main action.
- Parent area: a separate calm look, grey surface, blue accent, no Fredoka and no creatures.

## Files

- [`tokens.json`](tokens.json): colour, type, spacing, radius, touch targets and motion tokens.
- [`components.md`](components.md): component inventory, and what is not drawn yet.
- [`motion.md`](motion.md): tuck-in, nearly found, catch and handover curtain.
- [`canvas/`](canvas/): artboard sources.
  - `Main.dc.html`: tokens board.
  - `Motion.dc.html`: motion board.
  - `Creatures.dc.html`: creature sheets (six species × idle, peeking, nearly found, caught).
  - `Creature.dc.html`: procedural creature component.
  - `Room.dc.html`: an illustrated room that stands in for the camera, in back and front layers.
  - Screens: `Welcome`, `Download`, `Calibration`, `Hide`, `Handover`, `Seek`, `Results`, `Collection`, `SpeciesCard`, `Parent`.

## Assumptions to confirm

- Creatures are drawn in 2D here. M2 builds them in Three.js; these sheets set silhouette, proportions, eye placement and palette.
- Screens are in Spanish. English strings are expected to run up to 30% longer; buttons wrap to two lines before text shrinks.
- The hider chooses the species with chips in the hiding phase. The spec does not say who chooses.
- Hold-to-open on the handover curtain, so the hider cannot skip it by accident.
- Calibration uses Fideo, because it is the species that hides behind door frames.
