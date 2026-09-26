// The six species in 2D, ported from the design's creature sheets (docs/design/canvas/Creature.dc.html).
// Used where a 3D view would be overkill: the bestiary, species cards and menus.
import type { SpeciesId } from '../engine/species';
import { SPECIES } from '../engine/species';

export type Mood2D = 'idle' | 'near' | 'caught';

const EYES: Record<SpeciesId, { eyes: [number, number, number][]; mouth: [number, number] }> = {
  pompon: { eyes: [[80, 104, 15], [120, 104, 15]], mouth: [100, 134] },
  fideo: { eyes: [[88, 66, 11], [112, 66, 11]], mouth: [100, 88] },
  timido: { eyes: [[86, 138, 9], [114, 138, 9]], mouth: [100, 158] },
  curioso: { eyes: [[80, 108, 17], [121, 110, 13]], mouth: [100, 144] },
  dormilon: { eyes: [[78, 132, 11], [122, 132, 11]], mouth: [100, 154] },
  brillo: { eyes: [[86, 108, 12], [114, 108, 12]], mouth: [100, 128] },
};

function scallop(cx: number, cy: number, r: number, n: number, outer: number, inner: number): string {
  const pt = (k: number, rr: number) => {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + Math.cos(a) * r * rr).toFixed(1)} ${(cy + Math.sin(a) * r * rr).toFixed(1)}`;
  };
  let d = `M${pt(0, inner)}`;
  for (let k = 0; k < n; k++) d += ` Q${pt(k + 0.5, outer)} ${pt(k + 1, inner)}`;
  return `${d} Z`;
}

const POMPON = scallop(100, 114, 64, 22, 1.08, 0.95);
const BRILLO = scallop(100, 114, 54, 5, 1.32, 0.86);
const INK = 'var(--ink, #2B2140)';

function Body({ species, fill }: { species: SpeciesId; fill: string }) {
  const stroke = { stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' as const };
  switch (species) {
    case 'pompon':
      return <path d={POMPON} fill={fill} {...stroke} />;
    case 'fideo':
      return (
        <>
          <path d="M100 28 q -6 -16 8 -20 q 10 -2 8 8" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <rect x={70} y={28} width={60} height={160} rx={30} fill={fill} {...stroke} />
        </>
      );
    case 'timido':
      return (
        <>
          <path d="M80 112 q -16 -26 2 -38 q 12 18 -2 38 z" fill={fill} {...stroke} />
          <path d="M120 112 q 16 -26 -2 -38 q -12 18 2 38 z" fill={fill} {...stroke} />
          <ellipse cx={100} cy={142} rx={46} ry={38} fill={fill} {...stroke} />
        </>
      );
    case 'curioso':
      return (
        <g transform="rotate(-6 100 120)">
          <path d="M100 54 Q 104 32 118 24" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <circle cx={120} cy={22} r={9} fill="#FFC53D" stroke={INK} strokeWidth={4} />
          <path d="M100 54 C 140 54 152 100 150 130 C 148 168 124 184 100 184 C 76 184 52 168 50 130 C 48 100 60 54 100 54 Z" fill={fill} {...stroke} />
        </g>
      );
    case 'dormilon':
      return (
        <>
          <path d="M36 176 C 32 124 62 94 100 94 C 138 94 168 124 164 176 Z" fill={fill} {...stroke} />
          <path d="M66 106 C 76 70 110 54 148 62 C 134 76 130 92 132 104 Z" fill="#5B4BDB" {...stroke} />
          <circle cx={150} cy={62} r={10} fill="#fff" stroke={INK} strokeWidth={4} />
        </>
      );
    case 'brillo':
      return <path d={BRILLO} fill={fill} {...stroke} />;
  }
}

export function Creature2D({ species, mood = 'idle', size = 120, silhouette = false }: {
  species: SpeciesId;
  mood?: Mood2D;
  size?: number;
  /** Uncaught species in the bestiary: a dark shape with no face. */
  silhouette?: boolean;
}) {
  const { eyes, mouth } = EYES[species];
  const color = silhouette ? '#2B2140' : SPECIES[species].color;
  const asleep = species === 'dormilon' && mood === 'idle';
  const [mx, my] = mouth;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={silhouette ? '?' : SPECIES[species].name} style={{ overflow: 'visible', opacity: silhouette ? 0.28 : 1 }}>
      {species === 'brillo' && !silhouette && <circle cx={100} cy={112} r={96} fill="#FFE06B" opacity={0.3} />}
      <g transform={mood === 'caught' ? 'translate(100 188) scale(1.1 0.92) translate(-100 -188)' : undefined}>
        <Body species={species} fill={color} />
        {!silhouette && (
          <>
            {eyes.map(([cx, cy, r], i) => (
              <ellipse key={`b${i}`} cx={cx + (i ? 1 : -1) * r * 0.45} cy={cy + r * 1.45} rx={9} ry={5} fill="#FF8FB1" opacity={0.75} />
            ))}
            {eyes.map(([cx, cy, r], i) =>
              asleep ? (
                <path key={i} d={`M${cx - r} ${cy} Q${cx} ${cy + r * 0.9} ${cx + r} ${cy}`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
              ) : mood === 'caught' ? (
                <path key={i} d={`M${cx - r} ${cy + 3} Q${cx} ${cy - r * 1.2} ${cx + r} ${cy + 3}`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
              ) : (
                <g key={i}>
                  <ellipse cx={cx} cy={cy} rx={mood === 'near' ? r * 1.15 : r} ry={r * (mood === 'near' ? 1.45 : 1.15)} fill="#fff" stroke={INK} strokeWidth={4} />
                  <circle cx={cx + r * 0.15} cy={cy + r * 0.05} r={r * (mood === 'near' ? 0.38 : 0.56)} fill={INK} />
                  <circle cx={cx + r * 0.35} cy={cy - r * 0.2} r={Math.max(2, r * 0.17)} fill="#fff" />
                </g>
              ),
            )}
            {mood === 'caught' ? (
              <path d={`M${mx - 12} ${my - 3} Q${mx} ${my + 18} ${mx + 12} ${my - 3} Z`} fill={INK} />
            ) : (
              <path d={`M${mx - 8} ${my} Q${mx} ${my + 8} ${mx + 8} ${my}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
            )}
            {asleep && (
              <g fill={INK} fontFamily="Fredoka, sans-serif" fontWeight={700}>
                <text x={150} y={44} fontSize={22}>z</text>
                <text x={166} y={26} fontSize={16}>z</text>
              </g>
            )}
          </>
        )}
      </g>
    </svg>
  );
}
