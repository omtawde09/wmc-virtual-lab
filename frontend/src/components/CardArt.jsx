/**
 * Decorative animated artwork for the mobile experiment tiles.
 *
 * Rendered as inline SVG (not GIFs) so it stays crisp at any density, weighs
 * almost nothing, and inherits each tile's accent colour via `currentColor`.
 * Purely decorative — hidden from assistive tech, and the motion is disabled
 * under `prefers-reduced-motion` (see index.css).
 */
export default function CardArt({ kind }) {
  return (
    <span className={`card-art card-art-${kind}`} aria-hidden="true">
      {ART[kind] ?? null}
    </span>
  )
}

const ART = {
  /* Rising signal bars — Wi-Fi strength. */
  signal: (
    <svg viewBox="0 0 100 100">
      <rect className="ca-bar ca-b1" x="12" y="52" width="15" height="34" rx="5" />
      <rect className="ca-bar ca-b2" x="33" y="40" width="15" height="46" rx="5" />
      <rect className="ca-bar ca-b3" x="54" y="28" width="15" height="58" rx="5" />
      <rect className="ca-bar ca-b4" x="75" y="16" width="15" height="70" rx="5" />
    </svg>
  ),

  /* Packets streaming left to right — throughput. */
  speed: (
    <svg viewBox="0 0 100 100">
      <rect className="ca-dash ca-d1" x="6" y="30" width="50" height="10" rx="5" />
      <rect className="ca-dash ca-d2" x="6" y="45" width="68" height="10" rx="5" />
      <rect className="ca-dash ca-d3" x="6" y="60" width="38" height="10" rx="5" />
    </svg>
  ),

  /* Radiating rings — Bluetooth advertising. */
  radiate: (
    <svg viewBox="0 0 100 100">
      <circle className="ca-core" cx="50" cy="50" r="10" />
      <circle className="ca-ring ca-r1" cx="50" cy="50" r="20" fill="none" strokeWidth="6" />
      <circle className="ca-ring ca-r2" cx="50" cy="50" r="32" fill="none" strokeWidth="6" />
    </svg>
  ),

  /* Waves attenuating into a wall — path loss through obstacles. */
  wall: (
    <svg viewBox="0 0 100 100">
      <g className="ca-wall">
        <rect x="70" y="14" width="26" height="16" rx="3" />
        <rect x="70" y="33" width="26" height="16" rx="3" />
        <rect x="70" y="52" width="26" height="16" rx="3" />
        <rect x="70" y="71" width="26" height="16" rx="3" />
      </g>
      <path className="ca-arc ca-a1" d="M18 32 A22 22 0 0 1 18 68" fill="none" strokeWidth="6" strokeLinecap="round" />
      <path className="ca-arc ca-a2" d="M34 24 A34 34 0 0 1 34 76" fill="none" strokeWidth="6" strokeLinecap="round" />
      <path className="ca-arc ca-a3" d="M50 18 A44 44 0 0 1 50 82" fill="none" strokeWidth="6" strokeLinecap="round" />
    </svg>
  ),

  /* Two out-of-phase waves — multipath interference. */
  waves: (
    <svg viewBox="0 0 100 100">
      <path className="ca-wave ca-w1" d="M2 50 Q17 22 32 50 T62 50 T92 50" fill="none" strokeWidth="6" strokeLinecap="round" />
      <path className="ca-wave ca-w2" d="M2 58 Q17 86 32 58 T62 58 T92 58" fill="none" strokeWidth="6" strokeLinecap="round" />
    </svg>
  ),

  /* Irregular jittering bars — noise floor. */
  noise: (
    <svg viewBox="0 0 100 100">
      <rect className="ca-noise ca-n1" x="8" y="40" width="12" height="46" rx="4" />
      <rect className="ca-noise ca-n2" x="25" y="40" width="12" height="46" rx="4" />
      <rect className="ca-noise ca-n3" x="42" y="40" width="12" height="46" rx="4" />
      <rect className="ca-noise ca-n4" x="59" y="40" width="12" height="46" rx="4" />
      <rect className="ca-noise ca-n5" x="76" y="40" width="12" height="46" rx="4" />
    </svg>
  ),
}
