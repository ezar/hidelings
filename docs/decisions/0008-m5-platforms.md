# 0008: M5b Android WebXR and AR Quick Look

Date: 2026-09-26. Status: accepted, pending device checks on Android and iPhone.

## Context

Spec 9.4 and 9.5 add two optional platform paths: a WebXR `immersive-ar` mode on Android, where creatures are anchored in 6DoF, and "Verlo en tu habitación" from the collection through AR Quick Look on iOS. M5's acceptance for Android is that WebXR anchors creatures in 6DoF.

## Decisions

### Android WebXR

- A separate mode in the main menu, shown only when `navigator.xr.isSessionSupported('immersive-ar')` says yes. It plays pass-and-play: hide, curtain, seek, results. It uses the same round engine, rules, sounds and collection as the 3DoF game. The 3DoF game stays the default everywhere.
- The session asks for `hit-test` and, optionally, `anchors`, `depth-sensing` (CPU, luminance-alpha or float32) and `dom-overlay`. The HUD is a DOM overlay; its buttons cancel the `select` they would otherwise also cause.
- **Hiding**: a reticle follows the hit-test result. A tap puts the creature on that surface, facing the hider, at its real size (22 cm for Pompón), and asks for an anchor there. Anchor poses are applied every frame.
- **Occlusion**: when depth sensing is on, the room's depth is uploaded as a texture every frame, and a full-screen pass writes it into the depth buffer before the creatures are drawn. Furniture then hides them through the normal depth test, and the creature shaders run with their own occlusion off. The pass reads the depth at `normDepthBufferFromNormView` × (normalized view coordinates, top-left origin).
- **Visible share** for the rules (12% to catch, 85% to hide) comes from the CPU depth at 13 points across the creature. Without depth sensing, creatures count as fully visible, the hide check is skipped and the intro says furniture will not cover them.
- **Catching**: the tap's ray is tested against a sphere around each creature.
- **Hints**: the chirp is panned by where the nearest creature is. There is no arrow.
- The rear camera is closed before the session starts, because ARCore needs it. The camera stage opens it again when a 3DoF screen needs it.
- After the round, the session ends and the results show on the page. Anchors do not outlive the session, so "play again" starts a new hiding phase.

### AR Quick Look

- The creature is built with the game's builders. Its occlusion materials are swapped for standard materials of the same colour; the ink outlines and Brillo's additive halo are left out. It is scaled to real size, stood on the floor and exported with three.js's `USDZExporter` (Quick Look compatible).
- The button shows only where `rel="ar"` links are supported (iOS Safari) and only on the card of a species already caught. The file is made when the card opens, so the link is real when tapped, as Quick Look requires.

## Risks

- Nothing here could be tested on a device from the development environment. Headless Chromium has no WebXR and does not open Quick Look. The depth pass's coordinate conventions (the vertical flip, raw units) are the first thing to check on Android if occlusion looks wrong.
- Depth sensing on Android needs ARCore depth support. On phones without it the mode still works, without occlusion.
