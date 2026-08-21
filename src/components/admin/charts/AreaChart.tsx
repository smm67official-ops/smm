'use client';

import { useId, useState } from 'react';

export type AreaPoint = { label: string; value: number };

/**
 * Graphique d'évolution en SVG — aucune dépendance de charting.
 * Reprend le rendu d'ApexCharts utilisé dans UI_DASHY : dégradé sous
 * la courbe, grille horizontale légère, point survolé avec info-bulle.
 */
export default function AreaChart({
  points,
  height = 240,
  color = '#f2ba59',
  unit = 'number',
}: {
  points: AreaPoint[];
  height?: number;
  color?: string;
  /** `unit` plutôt qu'une fonction : les props d'un composant client
   *  doivent être sérialisables depuis un composant serveur. */
  unit?: 'number' | 'currency';
}) {
  const format = (value: number) =>
    unit === 'currency'
      ? `$${value.toFixed(value >= 10 || value === 0 ? 0 : 2)}`
      : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const gradientId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="gp-table__muted">No data for this period.</p>;
  }

  const W = 720;
  const H = height;
  const PAD = { top: 16, right: 12, bottom: 28, left: 46 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`;

  // 4 lignes de grille, valeurs arrondies pour rester lisibles.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: max * ratio,
    y: PAD.top + innerH - ratio * innerH,
  }));

  // Une étiquette sur N pour éviter le chevauchement.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="gp-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ height }}
        role="img"
        aria-label="Evolution chart"
      >
        <defs>
          <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick.ratio}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#eef2f7"
              strokeWidth="1"
            />
            <text x={PAD.left - 10} y={tick.y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {format(tick.value)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#grad-${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, i) => (
          <g key={point.label}>
            {(hover === i || points.length <= 12) && (
              <circle
                cx={x(i)}
                cy={y(point.value)}
                r={hover === i ? 5 : 3}
                fill="#ffffff"
                stroke={color}
                strokeWidth="2.5"
              />
            )}
            {/* Zone de survol invisible, plus large que le point */}
            <rect
              x={x(i) - step / 2}
              y={PAD.top}
              width={Math.max(step, 12)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            insetInlineEnd: 8,
            padding: '6px 12px',
            borderRadius: 8,
            background: '#1b1b2f',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {points[hover].label} · {format(points[hover].value)}
        </div>
      )}
    </div>
  );
}
