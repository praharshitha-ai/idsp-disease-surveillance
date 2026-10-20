import { useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { accent, amber, ink } from "../theme.js";

const W = 820;
const H = 380;
const M = { top: 14, right: 18, bottom: 30, left: 48 };
const DEFAULT_HORIZON = 2; // years to project

// Holt's linear trend (double exponential smoothing) — a lightweight forecast
// computed in-browser from the district's yearly series, with an uncertainty band
// that widens with the horizon. Counts can't go negative, so values are clipped.
function holt(y, h, alpha = 0.6, beta = 0.3) {
  if (y.length < 2) return { fit: y.slice(), fc: Array(h).fill(y[y.length - 1] ?? 0), sd: 0 };
  let level = y[0], trend = y[1] - y[0];
  const fit = [y[0]];
  for (let t = 1; t < y.length; t++) {
    const prevL = level;
    level = alpha * y[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevL) + (1 - beta) * trend;
    fit.push(level);
  }
  const fc = [];
  for (let hh = 1; hh <= h; hh++) fc.push(Math.max(0, level + hh * trend));
  const res = y.map((v, i) => v - fit[i]);
  const sd = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / Math.max(1, res.length - 1));
  return { fit, fc, sd };
}

export default function ForecastChart({ years, cases, maxYear, maxMonthIdx, horizon = DEFAULT_HORIZON }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const model = useMemo(() => {
    // Use complete years only for the history (the latest year may be partial).
    const partialLatest = maxMonthIdx < 11;
    const hist = years
      .map((yr, i) => ({ yr, v: cases[i] }))
      .filter((d) => !(partialLatest && d.yr === maxYear));
    const yv = hist.map((d) => d.v);
    const { fc, sd } = holt(yv, horizon);
    const lastYear = hist.length ? hist[hist.length - 1].yr : maxYear;
    const lastVal = hist.length ? hist[hist.length - 1].v : 0;

    const fcPts = fc.map((v, i) => {
      const hh = i + 1;
      const spread = 1.28 * sd * Math.sqrt(hh); // ~80% band, widening with horizon
      return { yr: lastYear + hh, v, lo: Math.max(0, v - spread), hi: v + spread };
    });
    return { hist, fcPts, lastYear, lastVal };
  }, [years, cases, maxYear, maxMonthIdx, horizon]);

  const { hist, fcPts, lastYear, lastVal } = model;

  const geom = useMemo(() => {
    const minYear = hist.length ? hist[0].yr : maxYear;
    const maxX = fcPts.length ? fcPts[fcPts.length - 1].yr : lastYear;
    const x = d3.scaleLinear().domain([minYear, maxX]).range([M.left, W - M.right]);
    const maxV = d3.max([...hist.map((d) => d.v), ...fcPts.map((d) => d.hi), 1]);
    const y = d3.scaleLinear().domain([0, maxV]).nice().range([H - M.bottom, M.top]);

    const actualLine = d3.line().x((d) => x(d.yr)).y((d) => y(d.v)).curve(d3.curveMonotoneX)(hist);
    const fcSeq = [{ yr: lastYear, v: lastVal }, ...fcPts];
    const fcLine = d3.line().x((d) => x(d.yr)).y((d) => y(d.v)).curve(d3.curveMonotoneX)(fcSeq);
    const band = d3.area().x((d) => x(d.yr))
      .y0((d) => y(d.lo ?? lastVal)).y1((d) => y(d.hi ?? lastVal)).curve(d3.curveMonotoneX)(
        [{ yr: lastYear, lo: lastVal, hi: lastVal }, ...fcPts]);
    return { x, y, actualLine, fcLine, band };
  }, [hist, fcPts, lastYear, lastVal, maxYear]);

  const { x, y } = geom;
  const allPts = [...hist, ...fcPts.map((d) => ({ ...d, forecast: true }))];

  const onMove = (e) => {
    const [px] = d3.pointer(e, svgRef.current);
    const yr = Math.round(x.invert(px));
    const pt = allPts.find((d) => d.yr === yr);
    setHover(pt || null);
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseMove={onMove}
         onMouseLeave={() => setHover(null)} role="img" aria-label="District yearly cases with forecast">
      <g className="gridline">
        {y.ticks(5).map((t) => <line key={t} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />)}
      </g>

      <path d={geom.band} fill={amber} opacity={0.12} />
      {/* split marker between history and forecast */}
      <line x1={x(lastYear)} x2={x(lastYear)} y1={M.top} y2={H - M.bottom} stroke={ink.faint} strokeWidth={1} strokeDasharray="2 3" />
      <text x={x(lastYear) + 4} y={M.top + 10} fontSize="11" fill={ink.muted}>forecast →</text>

      <path d={geom.fcLine} fill="none" stroke={amber} strokeWidth={2} strokeDasharray="5 4" />
      <path d={geom.actualLine} fill="none" stroke={accent.dark} strokeWidth={2} />
      {hist.map((d) => <circle key={d.yr} cx={x(d.yr)} cy={y(d.v)} r={2.6} fill={accent.dark} />)}
      {fcPts.map((d) => <circle key={d.yr} cx={x(d.yr)} cy={y(d.v)} r={2.6} fill={amber} />)}

      {/* axes */}
      <g className="axis" transform={`translate(0,${H - M.bottom})`}>
        <line x1={M.left} x2={W - M.right} y1={0} y2={0} />
        {x.ticks(8).map((t) => (
          <g key={t} transform={`translate(${x(t)},0)`}>
            <line y2={4} /><text y={16} textAnchor="middle">{t}</text>
          </g>
        ))}
      </g>
      <g className="axis" transform={`translate(${M.left},0)`}>
        {y.ticks(5).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            <line x2={-4} /><text x={-8} dy="0.32em" textAnchor="end">{d3.format("~s")(t)}</text>
          </g>
        ))}
        <text transform={`translate(${-M.left + 12},${M.top})rotate(-90)`} textAnchor="end" fontSize="11" fill={ink.muted}>cases / year</text>
      </g>

      {/* legend */}
      <g transform={`translate(${M.left + 6},${M.top})`} fontSize="11">
        <line x1={0} x2={18} y1={4} y2={4} stroke={accent.dark} strokeWidth={2} />
        <text x={24} y={8} fill={ink.secondary}>Actual</text>
        <line x1={92} x2={110} y1={4} y2={4} stroke={amber} strokeWidth={2} strokeDasharray="5 4" />
        <text x={116} y={8} fill={ink.secondary}>Forecast</text>
        <rect x={188} y={-1} width={16} height={10} fill={amber} opacity={0.12} />
        <text x={210} y={8} fill={ink.secondary}>~80% band</text>
      </g>

      {hover && (
        <g pointerEvents="none">
          <line x1={x(hover.yr)} x2={x(hover.yr)} y1={M.top} y2={H - M.bottom} stroke={ink.faint} strokeWidth={1} />
          <circle cx={x(hover.yr)} cy={y(hover.v)} r={3.6} fill={hover.forecast ? amber : accent.dark} stroke="#fff" strokeWidth={1.4} />
          <g transform={`translate(${x(hover.yr) + (x(hover.yr) > W - 140 ? -128 : 8)},${M.top})`}>
            <rect width={120} height={hover.forecast ? 46 : 32} rx={6} fill="#0f172a" opacity={0.92} />
            <text x={8} y={16} fontSize="11" fontWeight="600" fill="#fff">{hover.yr}{hover.forecast ? " (forecast)" : ""}</text>
            <text x={8} y={30} fontSize="11" fill="#fff">{Math.round(hover.v).toLocaleString()} cases</text>
            {hover.forecast && <text x={8} y={42} fontSize="10" fill="#cbd5e1">range {Math.round(hover.lo)}–{Math.round(hover.hi)}</text>}
          </g>
        </g>
      )}
    </svg>
  );
}
