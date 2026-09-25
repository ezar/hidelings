// Species data (spec 6.1). Data-driven: look, size, preferred hiding spot and behaviour parameters.
// Rendering reads the look; the engine reads the behaviour. M3 ships three species.

export type SpeciesId = 'pompon' | 'fideo' | 'timido';

/** Where a hiding spot's nearer object is: below or above (horizontal edge) or to the side (vertical edge). */
export type SpotKind = 'horizontal' | 'vertical';

export interface Species {
  id: SpeciesId;
  name: string;
  color: string;
  /** Multiplies the base creature size. */
  size: number;
  prefers: SpotKind | 'any';
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
};

export const M3_SPECIES: readonly SpeciesId[] = ['pompon', 'fideo', 'timido'];

/** A species that likes this kind of spot, chosen with `random` (0..1). Falls back to any M3 species. */
export function speciesForSpot(kind: SpotKind | null, random: number): SpeciesId {
  const fits = M3_SPECIES.filter(id => {
    const p = SPECIES[id].prefers;
    return kind === null || p === 'any' || p === kind;
  });
  const pool = fits.length ? fits : M3_SPECIES;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))]!;
}
