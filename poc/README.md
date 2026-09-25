# Hidelings PoC (M0)

Little creatures that hide behind the real things in your house. You point the phone around the room, spot one peeking out from behind the sofa, and catch it with a tap or a pinch.

This spike checks whether iPhone Safari, with no WebXR, can make that illusion convincing by combining three things:

1. **Monocular depth with AI**: Depth Anything V2 Small (Transformers.js, WebGPU with WASM fallback) estimates relative depth for every camera frame. Each creature pixel is hidden when the real scene is closer than the creature, so sofas, chairs and your own hand pass in front of them.
2. **Gyroscope anchoring (3DoF)**: DeviceOrientation turns each creature's position into a direction in the world, so it stays put when you turn the phone. The depth lookup is corrected for the rotation that happened since the depth frame was computed.
3. **Hands**: MediaPipe Hand Landmarker (optional) lets you catch creatures by pinching them with your fingers in front of the camera.

It also tries something no marker-based AR does: **finding hiding spots automatically**. "Esconder 5" scans the depth map for far points right next to much nearer objects (the edge of a sofa, a door frame, a chair leg) and hides creatures there, so they peek out naturally.

No build step. Plain ES modules; libraries load from jsDelivr and models from Hugging Face and Google, then stay cached in the browser.

## Run it

Camera and gyroscope need HTTPS:

1. Put this folder in a repo (for example `hidelings/poc/`) and enable GitHub Pages.
2. Open `https://ezar.github.io/hidelings/poc/` on the iPhone, in portrait.
3. Tap Empezar and allow motion and camera access.

On a desktop, any static server on localhost works (`npx serve .`). Without a gyroscope the creatures stay fixed on screen, but occlusion still works.

## How to play

- **Esconder**: tap just behind a piece of furniture to hide a creature there, or tap "Esconder 5" to let the depth map pick hiding spots. Look around: they stay where you left them.
- **Buscar**: hand the phone over. Creatures only show the parts not covered by real objects. Tap one, or turn on Manos and pinch it, to catch it. The timer stops when all are found.
- **Ajustes**: depth resolution, camera field of view, depth map preview, log and report.

## Test protocol

1. On the iPhone, tap Empezar and check in Ajustes whether depth runs on WebGPU and at what fps for each resolution (196, 252, 308). The second line splits each depth frame into capture, preprocessing, model (inference and readback), postprocessing and the full loop. The gyroscope line shows events per second and the longest gap between two events; a gap close to the depth time means depth is blocking the main thread.
2. Turn on the depth preview and point at a sofa, a table and a doorway. Note whether near and far are clearly separated.
3. Calibrate the field of view: hide a creature at the edge of a doorframe, turn the phone left and right, and adjust the slider until it stays glued to the frame instead of sliding.
4. Use "Esconder 5" in three rooms. Note how many spots it finds and how many look like believable hiding places.
5. Pass your hand in front of a creature. Note whether the hand hides it cleanly and how much lag there is.
6. Turn on Manos and play a full round of Buscar with pinch. Note the depth fps with hands on.
7. Play for five minutes and check the phone temperature and whether creatures drift.
8. Copy the report after each session.

## Questions M0 must answer

- Depth fps and latency on the iPhone at each resolution, with and without hands. Target: 8 fps or more at 252 px.
- Is per-frame relative depth stable enough for occlusion, or does the per-frame normalization make creatures flicker in and out?
- How much does the gyroscope drift over five minutes? Is alpha (yaw) usable without the compass?
- Is the 3DoF illusion convincing when the player walks, or only when standing and turning? (Walking moves the real objects but not the creatures.)
- Do automatic hiding spots feel natural?
- Can depth and MediaPipe hands run together on the iPhone without overheating?

## Known limits of this spike

- 3DoF only: rotation is tracked, translation is not. Walking around makes creatures slide relative to the room. A future version could estimate translation from optical flow, or anchor creatures to image features.
- Depth is relative and normalized per frame, not metric. Each creature stores its depth in that relative scale.
- Portrait only. Landscape shows a warning.
- Rendering is 2D canvas with per-pixel masking. A WebGL version with depth textures and 3D creatures belongs in M1.

## Licenses

- Depth Anything V2 **Small** is Apache 2.0. The Base and Large models are CC-BY-NC 4.0: do not switch to them if the project is MIT.
- MediaPipe Tasks and the hand landmarker model are Apache 2.0.
- The creatures are drawn procedurally; there are no image assets.
