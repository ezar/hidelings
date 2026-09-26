// Species data (spec 6.1). Data-driven: look, size, preferred hiding spot and behaviour parameters.
// Rendering reads the look; the engine reads the behaviour. M3 ships three species.

export type SpeciesId = 'pompon' | 'fideo' | 'timido' | 'curioso' | 'dormilon' | 'brillo';

/** Where a hiding spot's nearer object is: below or above (horizontal edge) or to the side (vertical edge). */
export type SpotKind = 'horizontal' | 'vertical';

/** Where a species likes to hide. 'dark' means the darker spots of the room. */
export type Preference = SpotKind | 'dark' | 'any';

export interface Species {
  id: SpeciesId;
  name: string;
  color: string;
  /** Multiplies the base creature size. */
  size: number;
  prefers: Preference;
  /** Rare species only appear under their condition (spec 4.4). */
  rare?: boolean;
  /** Tímido: pulls back when it has been more than `visibleAbove` visible for `afterMs`. */
  retreat?: { visibleAbove: number; afterMs: number; durationMs: number };
}

export const SPECIES: Record<SpeciesId, Species> = {
  pompon: { id: 'pompon', name: 'Pompón', color: '#7BE0AD', size: 1, prefers: 'horizontal' },
  fideo: { id: 'fideo', name: 'Fideo', color: '#FF9F6B', size: 1.1, prefers: 'vertical' },
  timido: {
    id: 'timido',
    name: 'Tímido',
    color: '#C3A8FF',
    size: 0.7,
    prefers: 'any',
    retreat: { visibleAbove: 0.5, afterMs: 1500, durationMs: 2500 },
  },
  curioso: { id: 'curioso', name: 'Curioso', color: '#6CC4FF', size: 0.95, prefers: 'any' },
  dormilon: { id: 'dormilon', name: 'Dormilón', color: '#9EA3F0', size: 1.05, prefers: 'dark' },
  brillo: { id: 'brillo', name: 'Brillo', color: '#FFE06B', size: 0.9, prefers: 'any', rare: true },
};

export const ALL_SPECIES: readonly SpeciesId[] = ['pompon', 'fideo', 'timido', 'curioso', 'dormilon', 'brillo'];
/** Species anyone can hide by hand; rare ones only when their condition holds. */
export const COMMON_SPECIES: readonly SpeciesId[] = ALL_SPECIES.filter(id => !SPECIES[id].rare);

/** Mean frame luminance (0..255) under which a room counts as dark: Brillo may appear. */
export const DARK_ROOM_LUMA = 70;

export function isDarkRoom(meanLuma: number | null): boolean {
  return meanLuma !== null && meanLuma < DARK_ROOM_LUMA;
}

/** Species available right now: the common ones, plus Brillo in a dark room. */
export function availableSpecies(meanLuma: number | null): SpeciesId[] {
  return isDarkRoom(meanLuma) ? [...COMMON_SPECIES, 'brillo'] : [...COMMON_SPECIES];
}

export const M3_SPECIES: readonly SpeciesId[] = ['pompon', 'fideo', 'timido'];

export interface SpotTraits {
  kind: SpotKind | null;
  /** Relative darkness of the spot within the room: true for the darker ones. */
  dark?: boolean;
}

/**
 * A species that likes this spot, chosen with `random` (0..1) among `pool`. In a dark room Brillo takes a
 * spot now and then; Dormilón takes the dark spots when it can.
 */
export function speciesForSpot(spot: SpotTraits | SpotKind | null, random: number, pool: readonly SpeciesId[] = M3_SPECIES): SpeciesId {
  const traits: SpotTraits = typeof spot === 'object' && spot !== null ? spot : { kind: spot };
  if (pool.includes('brillo') && random < 0.3) return 'brillo';
  if (traits.dark && pool.includes('dormilon') && random < 0.6) return 'dormilon';
  const fits = pool.filter(id => {
    const p = SPECIES[id].prefers;
    if (SPECIES[id].rare) return false;
    if (p === 'dark') return !!traits.dark;
    return traits.kind === null || p === 'any' || p === traits.kind;
  });
  const choices = fits.length ? fits : pool.filter(id => !SPECIES[id].rare);
  const list = choices.length ? choices : M3_SPECIES;
  return list[Math.min(list.length - 1, Math.floor(random * list.length))]!;
}
