# Component inventory

Every component the key screens use. Game components sit over the camera or on paper; parent components use the calm palette.

## Over the camera

| Component | Where | Notes |
| --- | --- | --- |
| HudPill | Hide, Seek | Glass background, white 15 px text, max 230 px wide. Instructions and hints. |
| CounterBadge | Hide, Seek | Honey pill with ink border, Fredoka 22–24 px. "2 escondidas" or "2 / 5". Bumps on catch. |
| TimerPill | Seek | Glass pill with clock icon, Fredoka 22 px. Starts on the first seeker frame. |
| SpotHint | Hide | Honey dot (r 5) in a dashed ring (r 13) and a 18% halo (r 22). Shimmers: ring rotates 8 s per turn, halo pulses 1.6 s. Static with reduced motion. |
| EdgeHint | Seek | Half pill on the screen edge, glass, honey chevron. Points at the nearest uncaught creature once the hint delay has passed. |
| PinchCursor | Seek, hands on | Two honey fingertip dots joined by a line, dashed ring when pinched. |
| SpeciesChips | Hide | 48 px colour chips in a glass pill; the selected one has a white ring. The name of the selected species sits next to them. |
| BottomBar | Hide, Seek | Two or three 56 px pill buttons, 10 px gap, 28 px above the home indicator. |
| Banner | Anywhere | Honey card, Fredoka 24 px, centred at 40% height. Short messages ("Pon el móvil en vertical"). |
| CalibrationPanel | Calibration | Paper card at the top with the task, glass panel at the bottom with left/right progress chips and the current field of view. |

## On paper

| Component | Where | Notes |
| --- | --- | --- |
| Button primary | Everywhere | Honey fill, 2 px ink border, pill, 56 px (60–64 px for the single main action). |
| Button secondary | Everywhere | White fill, 2 px ink border, pill, 56 px. |
| Button glass | Over camera | Glass fill, white text, no border. |
| LanguageToggle | Welcome | ES / EN segmented pill, 36 px. Also in the parent area. |
| PermissionList | Welcome | White card, three rows with 40 px icon tiles. Camera, motion, privacy. |
| ProgressBar | Download | 24 px pill, white track, honey fill, ink border. Shows MB and step ("Profundidad · 1 de 2"). |
| TipCard | Download | White card with Fredoka title and one tip. |
| Curtain | Handover | Berry panels with darker folds, honey scalloped valance, paper message card, hold-to-open button. |
| StatTile | Results, Species card | Big Fredoka number over a small label. |
| CatchStill | Results | Cropped room frame with the creature and a dashed honey ring, caption with visibility and catch method. |
| ReplayStrip | Results | Four 76 px tiles with the caught pose. |
| SpeciesTile | Collection | Caught: white card, creature, name, count. Locked: silhouette (filter to ink at 22%), "???" and a hint. Rare locked: ink card, light silhouette. |
| SpeciesCard | Species card | Large creature on a tinted panel, name, rarity, behaviour, two stat tiles, three pose tiles, "Verlo en tu habitación" (AR Quick Look, optional). |
| Creature | Everywhere | Procedural SVG, 200 × 200 viewBox, props `species`, `mood` (idle, peek, near, caught), `size`, `tint`. The reference for the Three.js models in M2. |

## Parent area

| Component | Notes |
| --- | --- |
| ParentGate | Hold a button for 3 s, then pick the answer to a simple sum ("7 + 5") from four buttons. A wrong answer restarts step 1; the sum changes every time. |
| SettingsGroup | Uppercase 13 px label over a white rounded list. |
| StepperRow | Label, minus, value, plus. 40 px buttons, 56 px row. |
| SwitchRow | Label and a 52 × 32 switch (`aria-pressed`). Accent blue when on. |
| ActionRow | Label, detail line, one small outline button. |
| DangerButton | White with red text and red border. Always asks to confirm. |

## States and interruptions

| Component | Where | Notes |
| --- | --- | --- |
| CoverageRing | Solo scan | Eight 45° arcs around a compass needle; an arc turns green once that direction has been seen. Sits in the paper card with the instruction. |
| SpotCounter | Solo scan | Mint pill with the number of hiding spots found so far. |
| DifficultyPicker | Solo scan | Three-way pill selector (Fácil, Normal, Difícil) with a one-line summary of what it changes. |
| SlowDownCard | Seek, Solo | Honey card with a startled Tímido. Camera dims to 55% and the HUD to 40% opacity. Clears by itself once the gyroscope settles for 1.5 s. |
| PauseSheet | Seek | Paper bottom sheet over a 60% veil: continue, hint, sound and hands switches, restart, exit. |
| TimeUpReveal | Seek | Uncaught creatures drawn on top of the scene (no occlusion) with a dashed honey ring and a "¡Aquí estaba!" label, happy pose. |
| LandscapeBlocker | Anywhere | Paper screen in landscape: rotating phone icon, message, sleeping Dormilón. The session keeps its state. |
