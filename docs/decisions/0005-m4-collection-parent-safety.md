# 0005: M4a collection, parent area and safety

Date: 2026-09-26. Status: accepted, pending the device check.

## Context

M4 (spec 17) adds solo play, all six species, the bestiary and spatial sound. It is split in two: M4a covers everything that does not depend on the room scan (species, collection, main menu, parent area, safety), and M4b covers solo mode. The owner asked for all development to continue without waiting for device tests.

## Decisions

- **Six species**: Curioso, Dormilón and Brillo join as 3D rigs built in code, with the same toon material and outline as the M3 ones. Curioso creeps a little out of its spot while the seeker looks away (at most 0.12 of extra peek, slowly). Dormilón closes its eyes and shows floating Zzz. Brillo glows with an additive halo, which is excluded from the visibility read-back so the glow never counts as "seen".
- **Species pools**: pass-and-play uses the four common species. Brillo is rare: it only appears in solo mode when the room is dark (mean frame luma under 70), wired in M4b.
- **Collection**: catches are stored in IndexedDB through Dexie (`catches: species, at, room, mode, method, visible`). No images are stored (spec 11). A catch of a species never caught before flashes "new in the collection". Parents can export and import the collection as JSON (import de-duplicates by species and time) and delete it.
- **Main menu** after start-up and calibration, instead of going straight into a round. The occlusion lab moves there.
- **Parent area** behind a two-step gate (hold for 3 s, then a sum with four answers). Settings: round time limit, first hint delay, session limit, whether creatures move in solo mode, sound, and the room name used in the collection. Stored with the other persisted settings; missing fields are filled from defaults so older installs keep working.
- **Safety** (spec 12): a "slow down" card covers the camera when the phone turns faster than 150°/s for 250 ms, and clears after 1.5 s of calm. After the session limit the break screen replaces the app until a grown-up passes the gate; the check skips the seek phase so a round is never cut in the middle.

## Not in M4a

- Solo mode, room scan, moving creatures, dark-room Brillo and spatial sound hints: M4b.
- "Verlo en tu habitación" (AR Quick Look) is a placeholder until M5.
