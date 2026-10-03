// Minimal hand-built SVG charts (no chart lib). Single series each → no legend; title names the series.
import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { formatNumber } from '@/lib/format';

const AXIS_TEXT = '#657385';
const GRID = '#E3E8EF';

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

export interface Point {
  label: string;
  value: number;
}

/** Line chart with crosshair + tooltip. */
export function LineChart({
  data,
  color = '#1B70BE',
  height = 240,
  unit = '',
}: {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 16, t: 16, b: 32 };
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg || data.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = data.length <= 1 ? 0 : Math.round(((px - pad.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Line chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
              {formatNumber(Math.round(t))}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text
              key={d.label}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize={11}
              fill={AXIS_TEXT}
            >
              {d.label}
            </text>
          ) : null,
        )}
        <path
          d={`${path} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
          fill={color}
          opacity={0.08}
        />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover !== null && data[hover] && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + ih}
              stroke={AXIS_TEXT}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <circle
              cx={x(hover)}
              cy={y(data[hover].value)}
              r={5}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > data.length / 2 ? '-110%' : '10%'})`,
          }}
        >
          <p className="text-slate">{data[hover].label}</p>
          <p className="font-semibold tabular-nums text-ink">
            {formatNumber(data[hover].value)}
            {unit}
          </p>
        </div>
      )}
    </div>
  );
}

/** Vertical bar chart with per-bar hover tooltip; bars have 4px rounded data-ends. */
export function BarChart({
  data,
  color = '#27B5C9',
  height = 240,
  unit = '',
}: {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 16, t: 16, b: 40 };
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = data.length ? iw / data.length : iw;
  const bw = Math.min(56, band * 0.6);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((f) => f * max), [max]);
  const r = 4;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Bar chart"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
              {formatNumber(Math.round(t))}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = y(d.value);
          const h = Math.max(0, pad.t + ih - top);
          const rr = Math.min(r, h / 2, bw / 2);
          const x0 = cx - bw / 2;
          const base = pad.t + ih;
          // Rounded top corners only, anchored to the baseline.
          const p = `M${x0},${base} L${x0},${top + rr} Q${x0},${top} ${x0 + rr},${top} L${x0 + bw - rr},${top} Q${x0 + bw},${top} ${x0 + bw},${top + rr} L${x0 + bw},${base} Z`;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              {h > 0 && (
                <path d={p} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
              )}
              <text x={cx} y={H - 16} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift"
          style={{
            left: `${((pad.l + band * hover + band / 2) / W) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-slate">{data[hover].label}</p>
          <p className="font-semibold tabular-nums text-ink">
            {formatNumber(data[hover].value)}
            {unit}
          </p>
        </div>
      )}
    </div>
  );
}

/** Accessible table view of chart data. */
export function ChartTable({ data, valueLabel }: { data: Point[]; valueLabel: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-slate hover:text-ink">
        Show as table
      </summary>
      <table className="table-base mt-2">
        <thead>
          <tr>
            <th>Label</th>
            <th className="text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td className="text-right tabular-nums">{formatNumber(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
