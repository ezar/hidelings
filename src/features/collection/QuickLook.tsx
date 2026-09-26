// "Verlo en tu habitación": AR Quick Look on iOS (spec 9.5), hidden where unsupported. Quick Look opens from a
// rel="ar" link that holds an image, so the model is exported when the card opens and the link is real.
import { useEffect, useState } from 'react';
import type { SpeciesId } from '../../engine/species';
import { log } from '../../app/report';
import { creatureUsdz, supportsQuickLook } from '../../render/usdz';

const SUPPORTED = supportsQuickLook();

export function QuickLookButton({ species, label }: { species: SpeciesId; label: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!SUPPORTED) return;
    let alive = true;
    let made: string | null = null;
    creatureUsdz(species).then(
      blob => {
        made = URL.createObjectURL(blob);
        if (alive) setUrl(made);
        else URL.revokeObjectURL(made);
      },
      e => log(`USDZ export error: ${String(e)}`),
    );
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [species]);

  if (!SUPPORTED || !url) return null;
  return (
    <a className="btn btn-primary btn-big" rel="ar" href={url} download={`${species}.usdz`}>
      {/* Quick Look needs an image as the link's first child. */}
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={1} height={1} style={{ position: 'absolute', opacity: 0 }} />
      {label}
    </a>
  );
}
