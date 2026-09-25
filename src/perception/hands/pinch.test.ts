import { describe, expect, it } from 'vitest';
import { coverMapping } from '../../render/viewMapping';
import { PinchStarts, fingerPairs, type Landmark } from './pinch';

const view = coverMapping(390, 844, 720, 1280);

function hand(thumb: [number, number], index: [number, number]): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[4] = { x: thumb[0], y: thumb[1] };
  lm[8] = { x: index[0], y: index[1] };
  return lm;
}

describe('fingerPairs', () => {
  it('detects a pinch when the tips nearly touch', () => {
    const [p] = fingerPairs([hand([0.5, 0.5], [0.51, 0.505])], view);
    expect(p!.pinched).toBe(true);
    expect(p!.mid.x).toBeCloseTo(195 + 0.005 * view.videoWidth, 0);
  });

  it('does not pinch with the fingers apart', () => {
    const [p] = fingerPairs([hand([0.4, 0.5], [0.6, 0.5])], view);
    expect(p!.pinched).toBe(false);
  });

  it('skips incomplete hands', () => {
    expect(fingerPairs([[{ x: 0, y: 0 }]], view)).toHaveLength(0);
  });
});

describe('PinchStarts', () => {
  it('fires once per pinch', () => {
    const s = new PinchStarts();
    const open = fingerPairs([hand([0.4, 0.5], [0.6, 0.5])], view);
    const closed = fingerPairs([hand([0.5, 0.5], [0.505, 0.5])], view);
    expect(s.update(open)).toBeNull();
    expect(s.update(closed)).not.toBeNull();
    expect(s.update(closed)).toBeNull();
    expect(s.update(open)).toBeNull();
    expect(s.update(closed)).not.toBeNull();
  });
});
