# hidelings

Little creatures that hide behind the real things in your house. Point the phone around the room, spot one peeking out from behind the sofa, and catch it with a tap or a pinch.

- **App**: https://ezar.github.io/hidelings/ (M4: pass-and-play and solo with six species, the collection, the parent area and the safety screens; the occlusion lab is on the main menu).
- **M0 proof of concept**: https://ezar.github.io/hidelings/poc/

## Docs

- [`docs/spec.md`](docs/spec.md): full specification and milestones (M0 to M5).
- [`docs/decisions/`](docs/decisions/): decision records, starting with the M0 results.
- [`docs/design/`](docs/design/): design tokens, components, motion and the screen designs.
- [`docs/models.md`](docs/models.md): every model and asset, with its license.

## Develop

Node 22.

```sh
npm install
npm run dev        # http://localhost:5173/hidelings/ ; add ?mock to skip the model download
npm run check      # typecheck, lint and unit tests
npm run build      # static site in dist/
```

Camera and motion sensors need HTTPS on a phone. Every push to `main` runs CI and deploys `dist/` (with `poc/` copied in) to GitHub Pages.

## Layout

```
src/
  app/            shell, session start flow, store, report
  engine/         species, game rules and the round state, without rendering or AI
  features/       onboarding, calibration, game (hide, curtain, seek, results), lab, shared camera stage
  perception/     depth (worker, engine, normalization, temporal blend), motion, spots, hands, probe
  render/         Three.js overlay, occlusion shader, creatures in 3D, view mapping
  audio/          synthesized sounds
  data/           model catalog and cache
  i18n/           Spanish and English strings
poc/              M0 proof of concept, unchanged
```
