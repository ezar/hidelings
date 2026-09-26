// The family's bestiary (spec 4.4, 11): every catch, kept in IndexedDB through Dexie. No images.
import Dexie, { type Table } from 'dexie';
import { ALL_SPECIES, type SpeciesId } from '../engine/species';

export interface CatchRecord {
  id?: number;
  species: SpeciesId;
  at: number;
  room: string;
  mode: 'pass' | 'solo';
  method: 'tap' | 'pinch';
  visible: number;
}

export interface SpeciesStats {
  species: SpeciesId;
  count: number;
  firstAt: number | null;
  firstRoom: string | null;
}

class HidelingsDb extends Dexie {
  catches!: Table<CatchRecord, number>;

  constructor(name = 'hidelings') {
    super(name);
    this.version(1).stores({ catches: '++id, species, at' });
  }
}

let db: HidelingsDb | null = null;
const getDb = () => (db ??= new HidelingsDb());

/** For tests: use a fresh database. */
export function useDatabase(name: string) {
  db?.close();
  db = new HidelingsDb(name);
}

/** Records a catch. Returns true when it is the first of its species (a new bestiary entry). */
export async function recordCatch(record: Omit<CatchRecord, 'id'>): Promise<boolean> {
  const d = getDb();
  return d.transaction('rw', d.catches, async () => {
    const before = await d.catches.where('species').equals(record.species).count();
    await d.catches.add(record);
    return before === 0;
  });
}

export async function speciesStats(): Promise<Map<SpeciesId, SpeciesStats>> {
  const out = new Map<SpeciesId, SpeciesStats>(
    ALL_SPECIES.map(s => [s, { species: s, count: 0, firstAt: null, firstRoom: null }]),
  );
  await getDb().catches.orderBy('at').each(c => {
    const s = out.get(c.species);
    if (!s) return;
    s.count++;
    if (s.firstAt === null) {
      s.firstAt = c.at;
      s.firstRoom = c.room;
    }
  });
  return out;
}

export async function totalCatches(): Promise<number> {
  return getDb().catches.count();
}

export async function clearCollection(): Promise<void> {
  await getDb().catches.clear();
}

export interface CollectionExport {
  app: 'hidelings';
  version: 1;
  exportedAt: string;
  catches: Omit<CatchRecord, 'id'>[];
}

export async function exportCollection(): Promise<CollectionExport> {
  const catches = (await getDb().catches.orderBy('at').toArray()).map(({ id: _id, ...c }) => c);
  return { app: 'hidelings', version: 1, exportedAt: new Date().toISOString(), catches };
}

/** Merges an exported collection, skipping catches already present (same species and time). */
export async function importCollection(data: unknown): Promise<number> {
  const parsed = data as Partial<CollectionExport> | null;
  if (!parsed || parsed.app !== 'hidelings' || !Array.isArray(parsed.catches)) throw new Error('Not a Hidelings collection');
  const valid = parsed.catches.filter(
    (c): c is Omit<CatchRecord, 'id'> =>
      !!c && ALL_SPECIES.includes(c.species) && Number.isFinite(c.at) && typeof c.room === 'string',
  );
  const d = getDb();
  return d.transaction('rw', d.catches, async () => {
    const existing = new Set((await d.catches.toArray()).map(c => `${c.species}@${c.at}`));
    const fresh = valid
      .filter(c => !existing.has(`${c.species}@${c.at}`))
      .map(c => ({ species: c.species, at: c.at, room: c.room, mode: c.mode === 'solo' ? 'solo' as const : 'pass' as const, method: c.method === 'pinch' ? 'pinch' as const : 'tap' as const, visible: Number(c.visible) || 0 }));
    await d.catches.bulkAdd(fresh);
    return fresh.length;
  });
}
