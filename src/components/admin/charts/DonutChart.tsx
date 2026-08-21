'use client';

export type DonutSlice = { label: string; value: number; color: string };

/** Répartition en anneau, avec légende chiffrée. */
export default function DonutChart({
  slices,
  size = 190,
  centerLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const radius = 70;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="gp-donut-wrap">
      <svg width={size} height={size} viewBox="0 0 180 180" role="img" aria-label="Breakdown">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef2f7" strokeWidth={stroke} />

        {total > 0 &&
          slices.map((slice) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={slice.label}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 90 90)"
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return element;
          })}

        <text x="90" y="88" textAnchor="middle" className="gp-donut-center">
          {total}
        </text>
        {centerLabel && (
          <text x="90" y="106" textAnchor="middle" className="gp-donut-sub">
            {centerLabel}
          </text>
        )}
      </svg>

      <div className="gp-chart-legend" style={{ flexDirection: 'column', gap: 10, marginTop: 0 }}>
        {slices.map((slice) => (
          <span className="gp-chart-legend__item" key={slice.label}>
            <span className="gp-chart-legend__swatch" style={{ background: slice.color }} />
            {slice.label}
            <b className="gp-chart-legend__value">{slice.value}</b>
            {total > 0 && (
              <span className="gp-table__muted">{Math.round((slice.value / total) * 100)}%</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
