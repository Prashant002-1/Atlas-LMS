import type { PracticeBase } from "@/lib/practice/base";
import type { CSSProperties } from "react";
import { CodeList } from "@/components/atlas/primitives";
import { RecordFact } from "@/components/atlas/record";

export function PracticeBaseStrip({ base }: { base: PracticeBase }) {
  return (
    <section className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 md:grid-cols-[92px_minmax(0,1fr)_170px] md:items-center">
      <PracticeGlyph />
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-muted)]">Practice base</p>
        <h3 className="mt-1 text-[15px] font-semibold leading-6 text-[var(--color-ink)]">{base.title}</h3>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--color-muted)]">{base.frame}</p>
      </div>
      <div className="grid gap-2 text-[13px]">
        <RecordFact label="Data" value={base.dataset} />
        <RecordFact label="Variants" value={base.variants.length} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--color-muted)]">Concepts</span>
          <CodeList codes={base.conceptCodes} />
        </div>
      </div>
    </section>
  );
}

export function PracticeBasePanel({ base }: { base: PracticeBase }) {
  return (
    <div className="border-b border-[var(--color-border)] pb-4">
      <div className="flex items-start gap-3">
        <PracticeGlyph compact />
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--color-ink)]">Data</p>
          <p className="mt-1 text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{base.dataset}</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-muted)]">{base.frame}</p>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[var(--color-faint)]">{base.variables.join(" / ")}</p>
    </div>
  );
}

export function PracticeVariants({ base, limit = 3 }: { base: PracticeBase; limit?: number }) {
  const variants = base.variants.slice(0, limit);
  if (variants.length === 0) return null;

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <p className="text-[12px] font-medium text-[var(--color-ink)]">Ways to practice</p>
      <div className="mt-2 divide-y divide-[var(--color-border)]">
        {variants.map((variant) => (
          <p key={variant} className="py-2 text-[13px] leading-5 text-[var(--color-ink)] first:pt-0 last:pb-0">
            {variant}
          </p>
        ))}
      </div>
    </div>
  );
}

function PracticeGlyph({ compact = false }: { compact?: boolean }) {
  const points = compact
    ? [
        [1, 2],
        [2, 1],
        [3, 3],
        [5, 2],
        [6, 4],
      ]
    : [
        [1, 5],
        [2, 2],
        [3, 4],
        [4, 1],
        [5, 3],
        [6, 6],
        [7, 2],
      ];

  return (
    <div className={`atlas-practice-glyph ${compact ? "atlas-practice-glyph--compact" : ""}`} aria-hidden="true">
      {points.map(([x, y]) => (
        <span key={`${x}-${y}`} style={{ "--x": x, "--y": y } as CSSProperties} />
      ))}
    </div>
  );
}
