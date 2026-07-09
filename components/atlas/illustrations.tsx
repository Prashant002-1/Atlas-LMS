/**
 * The Atlas illustration set: four small line drawings in the mark's
 * cartography language (measured ticks, one fixed point of orientation).
 * They appear ONLY in empty and completion states, and each one explains
 * the state it stands for; nothing here is screen decoration.
 *
 * Strokes ride on currentColor so the parent sets the ink (usually
 * --color-faint); the single point of orientation is always the accent.
 */

const STROKE = 1.25;

function Star({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <g stroke="var(--color-accent)" strokeWidth={STROKE} strokeLinecap="round">
      <path d={`M${x} ${y - r} V${y + r}`} />
      <path d={`M${x - r} ${y} H${x + r}`} />
      <circle cx={x} cy={y} r={1.4} fill="var(--color-accent)" stroke="none" />
    </g>
  );
}

/** A still horizon under one fixed star: nothing is pending here. */
export function ClearHorizonArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 88" width={176} height={78} aria-hidden="true" className={className} fill="none">
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
        <path d="M12 62 H188" />
        <path d="M28 70 H172" opacity={0.4} />
        <path d="M46 78 H154" opacity={0.18} />
        <path d="M54 62 V57" opacity={0.55} />
        <path d="M100 62 V55" opacity={0.55} />
        <path d="M146 62 V57" opacity={0.55} />
      </g>
      <Star x={100} y={28} />
    </svg>
  );
}

/** An unfolded chart with the route not yet plotted: no records here yet. */
export function OpenAtlasArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 88" width={176} height={78} aria-hidden="true" className={className} fill="none">
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M36 20 L100 14 L164 20 L172 68 L100 74 L28 68 Z" />
        <path d="M100 14 V74" opacity={0.35} />
        <path d="M44 44 C60 36 76 48 92 40" opacity={0.3} />
        <path d="M112 56 C128 48 142 58 156 50" opacity={0.3} />
        <path d="M48 58 C70 44 92 54 116 38 C132 28 146 30 152 33" strokeDasharray="2 4" opacity={0.7} />
        <circle cx={48} cy={58} r={2.4} />
      </g>
      <Star x={154} y={32} r={6} />
    </svg>
  );
}

/** A flag on the summit, the climb marked behind it: this work is done. */
export function SummitFlagArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 88" width={176} height={78} aria-hidden="true" className={className} fill="none">
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 74 H184" opacity={0.45} />
        <path d="M58 74 L112 26 L152 74" />
        <path d="M34 74 L66 48" opacity={0.35} />
        <path d="M72 62 L104 34" strokeDasharray="2 4" opacity={0.6} />
      </g>
      <g>
        <path d="M112 26 V10" stroke="var(--color-accent)" strokeWidth={STROKE} strokeLinecap="round" />
        <path d="M112 10 L126 14 L112 18 Z" fill="var(--color-accent)" />
      </g>
    </svg>
  );
}

/** A quiet month, one day held by the star: nothing scheduled in this range. */
export function QuietMonthArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 88" width={176} height={78} aria-hidden="true" className={className} fill="none">
      <g stroke="currentColor" strokeWidth={STROKE}>
        <rect x={32} y={16} width={136} height={56} rx={3} />
        <path d="M32 30 H168" opacity={0.5} />
        <path d="M32 44 H168" opacity={0.3} />
        <path d="M32 58 H168" opacity={0.3} />
        <path d="M51.4 30 V72 M70.8 30 V72 M90.2 30 V72 M109.6 30 V72 M129 30 V72 M148.4 30 V72" opacity={0.3} />
        <circle cx={61} cy={51} r={1.5} fill="currentColor" stroke="none" opacity={0.5} />
        <circle cx={100} cy={65} r={1.5} fill="currentColor" stroke="none" opacity={0.5} />
      </g>
      <Star x={139} y={51} r={5.5} />
    </svg>
  );
}

export const EMPTY_STATE_ART = {
  horizon: ClearHorizonArt,
  atlas: OpenAtlasArt,
  summit: SummitFlagArt,
  month: QuietMonthArt,
} as const;

export type EmptyStateArt = keyof typeof EMPTY_STATE_ART;
