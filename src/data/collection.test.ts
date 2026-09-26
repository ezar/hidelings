import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCollection, exportCollection, importCollection, recordCatch, speciesStats, totalCatches, useDatabase } from './collection';

let n = 0;
beforeEach(() => useDatabase(`test-${n++}`));

const c = (species: 'pompon' | 'fideo', at: number, room = 'Salón') => ({ species, at, room, mode: 'pass' as const, method: 'tap' as const, visible: 0.3 });

describe('collection', () => {
  it('records catches and flags the first of each species', async () => {
    expect(await recordCatch(c('pompon', 1))).toBe(true);
    expect(await recordCatch(c('pompon', 2))).toBe(false);
    expect(await recordCatch(c('fideo', 3, 'Cocina'))).toBe(true);
    const stats = await speciesStats();
    expect(stats.get('pompon')).toMatchObject({ count: 2, firstAt: 1, firstRoom: 'Salón' });
    expect(stats.get('fideo')).toMatchObject({ count: 1, firstRoom: 'Cocina' });
    expect(stats.get('brillo')).toMatchObject({ count: 0, firstAt: null });
    expect(await totalCatches()).toBe(3);
  });

  it('exports and imports without duplicates', async () => {
    await recordCatch(c('pompon', 1));
    const dump = await exportCollection();
    useDatabase(`test-${n++}`);
    expect(await importCollection(dump)).toBe(1);
    expect(await importCollection(dump)).toBe(0);
    expect(await totalCatches()).toBe(1);
  });

  it('rejects files that are not a collection and skips invalid entries', async () => {
    await expect(importCollection({ foo: 1 })).rejects.toThrow();
    expect(await importCollection({ app: 'hidelings', version: 1, catches: [{ species: 'dragon', at: 1, room: 'x' }, c('fideo', 5)] })).toBe(1);
  });

  it('clears the collection', async () => {
    await recordCatch(c('pompon', 1));
    await clearCollection();
    expect(await totalCatches()).toBe(0);
  });
});
