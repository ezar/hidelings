// Pompón peeking over an edge (docs/design, creature sheets). A 2D stand-in until the 3D creatures of M2.

function scallop(cx: number, cy: number, r: number, n: number, outer: number, inner: number): string {
  const pt = (k: number, rr: number) => {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + Math.cos(a) * r * rr).toFixed(1)} ${(cy + Math.sin(a) * r * rr).toFixed(1)}`;
  };
  let d = `M${pt(0, inner)}`;
  for (let k = 0; k < n; k++) d += ` Q${pt(k + 0.5, outer)} ${pt(k + 1, inner)}`;
  return `${d} Z`;
}

const BODY = scallop(100, 114, 64, 22, 1.08, 0.95);

export function PomponPeeking({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 200 180" role="img" aria-label="Pompón">
      <g className="pompon-bob">
        <path d={BODY} fill="var(--species-pompon)" stroke="var(--ink)" strokeWidth={5} strokeLinejoin="round" />
        {[80, 120].map(x => (
          <g key={x}>
            <ellipse cx={x + (x < 100 ? -7 : 7)} cy={121} rx={9} ry={5} fill="var(--blush)" opacity={0.75} />
            <ellipse cx={x} cy={104} rx={15} ry={17} fill="#fff" stroke="var(--ink)" strokeWidth={4} />
            <circle cx={x} cy={102} r={8} fill="var(--ink)" />
            <circle cx={x + 3} cy={99} r={2.6} fill="#fff" />
          </g>
        ))}
      </g>
      <rect x={-12} y={124} width={224} height={70} rx={6} fill="var(--wood)" stroke="var(--ink)" strokeWidth={5} />
      <rect x={-6} y={131} width={212} height={6} rx={3} fill="#d2a474" />
      <ellipse cx={78} cy={124} rx={12} ry={8} fill="var(--species-pompon)" stroke="var(--ink)" strokeWidth={4} />
      <ellipse cx={122} cy={124} rx={12} ry={8} fill="var(--species-pompon)" stroke="var(--ink)" strokeWidth={4} />
    </svg>
  );
}
