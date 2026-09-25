// Pinch detection (spec 7.3): thumb tip to index tip closer than 6% of the screen's shorter side.
// A catch fires on the pinch start, not while the fingers stay closed.
import type { ViewMapping } from '../../render/viewMapping';
import { videoToScreen } from '../../render/viewMapping';

export interface Landmark {
  x: number;
  y: number;
}

export interface FingerPair {
  thumb: { x: number; y: number };
  index: { x: number; y: number };
  mid: { x: number; y: number };
  pinched: boolean;
}

const THUMB_TIP = 4;
const INDEX_TIP = 8;

/** Thumb and index tips of each detected hand in screen pixels, and whether they pinch. */
export function fingerPairs(hands: readonly (readonly Landmark[])[], view: ViewMapping, ratio = 0.06): FingerPair[] {
  const limit = Math.min(view.width, view.height) * ratio;
  const out: FingerPair[] = [];
  for (const hand of hands) {
    const t = hand[THUMB_TIP];
    const i = hand[INDEX_TIP];
    if (!t || !i) continue;
    const thumb = videoToScreen(view, { u: t.x, v: t.y });
    const index = videoToScreen(view, { u: i.x, v: i.y });
    out.push({
      thumb,
      index,
      mid: { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 },
      pinched: Math.hypot(thumb.x - index.x, thumb.y - index.y) < limit,
    });
  }
  return out;
}

/** Reports where a pinch starts. One pinch at a time is enough for catching. */
export class PinchStarts {
  private down = false;

  update(pairs: readonly FingerPair[]): { x: number; y: number } | null {
    const pinch = pairs.find(p => p.pinched);
    const started = !!pinch && !this.down;
    this.down = !!pinch;
    return started ? pinch!.mid : null;
  }
}
