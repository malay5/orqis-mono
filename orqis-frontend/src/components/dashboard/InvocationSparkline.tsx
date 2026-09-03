import type { DailyBucket } from "@/lib/seller-analytics";

/**
 * Inline-SVG stacked-bar chart of invocations per day. No chart library —
 * keeps the bundle small and the visual aligned with the rest of the dark UI.
 *
 * Bars stack succeeded (cyan, full opacity) on top of failed+refunded (pink),
 * with pending (violet, dimmed) underneath. Days with zero invocations get
 * a thin baseline tick.
 */
export function InvocationSparkline({
  data,
  height = 140,
  className = "",
}: {
  data: DailyBucket[];
  height?: number;
  className?: string;
}) {
  if (data.length === 0) return null;

  const peak = Math.max(
    1,
    ...data.map((d) => d.succeeded + d.failed + d.pending)
  );
  // Use a fixed grid: 30 columns (one per day), gap derived from total width.
  const width = 600; // viewBox; scales responsively
  const cols = data.length;
  const gap = 3;
  const colW = (width - gap * (cols - 1)) / cols;
  const innerH = height - 28; // leave room for x-axis labels

  // Pretty round-numbered y-axis tick: nearest 5/10/25/50/100/etc.
  const niceTick = (n: number): number => {
    const exp = Math.floor(Math.log10(n));
    const base = Math.pow(10, exp);
    for (const m of [1, 2, 5, 10]) {
      const cand = m * base;
      if (cand >= n / 2) return cand;
    }
    return n;
  };
  const tick = niceTick(peak);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${className}`}
      role="img"
      aria-label="Invocations per day for the last 30 days"
    >
      {/* horizontal gridline at the tick mark */}
      <line
        x1={0}
        x2={width}
        y1={innerH - (tick / peak) * innerH}
        y2={innerH - (tick / peak) * innerH}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
      />
      <text
        x={width}
        y={innerH - (tick / peak) * innerH - 4}
        textAnchor="end"
        fill="rgba(255,255,255,0.35)"
        fontSize={9}
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {tick}
      </text>

      {data.map((d, i) => {
        const x = i * (colW + gap);
        const total = d.succeeded + d.failed + d.pending;
        if (total === 0) {
          // baseline tick so the empty days are still legible
          return (
            <line
              key={d.date}
              x1={x + colW / 2}
              x2={x + colW / 2}
              y1={innerH - 1}
              y2={innerH}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
          );
        }
        const scale = innerH / peak;
        const hSucc = d.succeeded * scale;
        const hFail = d.failed * scale;
        const hPend = d.pending * scale;
        let y = innerH;
        return (
          <g key={d.date}>
            {hSucc > 0 && (
              <rect
                x={x}
                y={(y -= hSucc)}
                width={colW}
                height={hSucc}
                fill="#06b6d4"
                rx={1}
              >
                <title>{`${d.date} · ${d.succeeded} succeeded`}</title>
              </rect>
            )}
            {hFail > 0 && (
              <rect
                x={x}
                y={(y -= hFail)}
                width={colW}
                height={hFail}
                fill="#ec4899"
                opacity={0.8}
                rx={1}
              >
                <title>{`${d.date} · ${d.failed} failed/refunded`}</title>
              </rect>
            )}
            {hPend > 0 && (
              <rect
                x={x}
                y={(y -= hPend)}
                width={colW}
                height={hPend}
                fill="#a855f7"
                opacity={0.5}
                rx={1}
              >
                <title>{`${d.date} · ${d.pending} pending`}</title>
              </rect>
            )}
          </g>
        );
      })}

      {/* sparse x labels: first, middle, last */}
      {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
        const x = i * (colW + gap) + colW / 2;
        return (
          <text
            key={`xl-${i}`}
            x={x}
            y={height - 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize={9}
            fontFamily="ui-monospace, SFMono-Regular, monospace"
          >
            {data[i].date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}
