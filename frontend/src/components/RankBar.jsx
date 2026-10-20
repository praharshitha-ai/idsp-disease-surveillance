import { useMemo } from "react";
import * as d3 from "d3";
import { ink } from "../theme.js";
import { showTip, moveTip, hideTip } from "../lib/tooltip.js";

const W = 520;
const M = { top: 6, right: 60, bottom: 24, left: 150 };
const ROW = 24;

// Generic horizontal ranking bar. Bar LENGTH is scaled to this list's own max
// (readability); bar COLOR comes from a shared magnitude scale (absolute), so
// green=low / red=high stays consistent between the top-10 and bottom-10 lists.
export default function RankBar({ items, colorScale, selected, onSelect, emptyNote }) {
  const { x, H, maxV } = useMemo(() => {
    const maxV = d3.max(items, (d) => d.cases) || 1;
    const H = M.top + M.bottom + Math.max(1, items.length) * ROW;
    const x = d3.scaleLinear().domain([0, maxV]).range([M.left, W - M.right]);
    return { x, H, maxV };
  }, [items]);

  if (!items.length) {
    return <p className="card-sub" style={{ padding: "8px 4px" }}>{emptyNote || "No data in scope."}</p>;
  }

  const xTicks = x.ticks(4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Ranked bar chart">
      <g className="gridline">
        {xTicks.map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={M.top} y2={H - M.bottom} />
        ))}
      </g>
      {items.map((r, i) => {
        const y = M.top + i * ROW;
        const active = r.key === selected;
        return (
          <g key={r.key} transform={`translate(0,${y})`} style={{ cursor: onSelect ? "pointer" : "default" }}
             onMouseEnter={(e) =>
               showTip(`<b>${r.label}</b>${r.sublabel ? `, ${r.sublabel}` : ""}<br/>Cases: ${d3.format(",")(r.cases)}`, e)
             }
             onMouseMove={moveTip}
             onMouseLeave={hideTip}
             onClick={() => onSelect && onSelect(active ? null : r.key)}>
            <text x={M.left - 8} y={ROW / 2} dy="0.32em" textAnchor="end" fontSize="11.5"
                  fill={active ? ink.primary : ink.secondary} fontWeight={active ? 600 : 400}>
              {clip(r.label, 20)}
            </text>
            <rect x={M.left} y={4} width={Math.max(1, x(r.cases) - M.left)} height={ROW - 9} rx={3}
                  fill={colorScale(Math.max(1, r.cases))}
                  stroke={active ? ink.primary : "none"} strokeWidth={active ? 1.4 : 0} />
            <text x={x(r.cases) + 6} y={ROW / 2} dy="0.32em" fontSize="11" fill={ink.muted}>
              {d3.format(",")(r.cases)}
            </text>
          </g>
        );
      })}
      <g className="axis" transform={`translate(0,${H - M.bottom})`}>
        <line x1={M.left} x2={W - M.right} y1={0} y2={0} />
        {xTicks.map((t) => (
          <g key={t} transform={`translate(${x(t)},0)`}>
            <line y2={4} />
            <text y={16} textAnchor="middle">{d3.format("~s")(t)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function clip(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
