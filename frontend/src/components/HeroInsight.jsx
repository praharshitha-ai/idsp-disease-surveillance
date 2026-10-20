import { useMemo } from "react";
import * as d3 from "d3";
import { accent, ink } from "../theme.js";

const W = 360;
const H = 92;
const M = { top: 8, right: 40, bottom: 16, left: 6 };

const fmtK = (v) => d3.format(",")(Math.round(v)); // exact, comma-grouped (matches map/chatbot)

// Power-BI-style headline with a YEAR filter: big number for the selected year,
// a year-over-year callout, and a this-year (bold) vs last-year (faint) monthly
// sparkline. More cases = worse, so an increase is red and a decrease green.
export default function HeroInsight({
  monthlyByYear, months, years, maxYear, maxMonthIdx, year, onYearChange, scopeLabel, noun = "Cases",
}) {
  const lastMonthIdx = year === maxYear ? maxMonthIdx : 11; // latest year is partial ("to date")
  const cur = monthlyByYear?.[String(year)] || null;
  const prv = monthlyByYear?.[String(year - 1)] || null;

  const model = useMemo(() => {
    const latest = cur ? cur.map((v, i) => (i <= lastMonthIdx ? v : null)) : Array(12).fill(null);
    const latestTotal = cur ? cur.reduce((a, v, i) => (i <= lastMonthIdx ? a + v : a), 0) : 0;
    const prevToDate = prv ? prv.slice(0, lastMonthIdx + 1).reduce((a, b) => a + b, 0) : null;

    let trend;
    if (prvNull(prv)) trend = { dir: "none", text: `No ${year - 1} data to compare`, color: ink.muted };
    else {
      const diff = latestTotal - prevToDate;
      if (prevToDate === 0)
        trend = diff > 0 ? { dir: "up", text: "New reports this year", color: "#c0392b" }
                         : { dir: "flat", text: "About the same as last year", color: ink.muted };
      else {
        const pct = Math.round((diff / prevToDate) * 100);
        trend = pct > 0 ? { dir: "up", text: `${pct}% higher than ${year - 1}`, color: "#c0392b" }
              : pct < 0 ? { dir: "down", text: `${Math.abs(pct)}% lower than ${year - 1}`, color: "#1a9850" }
                        : { dir: "flat", text: `About the same as ${year - 1}`, color: ink.muted };
      }
    }
    return { latest, latestTotal, trend };
  }, [cur, prv, lastMonthIdx, year]);

  const spark = useMemo(() => {
    const x = d3.scalePoint().domain(d3.range(12)).range([M.left, W - M.right]);
    const maxV = d3.max([...(prv || []), ...model.latest].filter((v) => v != null)) || 1;
    const y = d3.scaleLinear().domain([0, maxV]).range([H - M.bottom, M.top]);
    const line = d3.line().defined((d) => d.v != null).x((d) => x(d.i)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
    return {
      x,
      latPath: line(model.latest.map((v, i) => ({ i, v }))),
      prevPath: prv ? line(prv.map((v, i) => ({ i, v }))) : null,
      dotX: x(lastMonthIdx), dotY: y(model.latest[lastMonthIdx] ?? 0),
    };
  }, [model.latest, prv, lastMonthIdx]);

  const arrow = { up: "▲", down: "▼", flat: "▬", none: "" }[model.trend.dir];
  const yearRangeLabel = year === maxYear ? `Jan–${months[maxMonthIdx]}` : "full year";

  return (
    <div className="hero">
      <div className="hero-main">
        <div className="hero-top">
          <div className="hero-value">{fmtK(model.latestTotal)} <span>{noun}</span></div>
          <label className="hero-year">
            <span>Year</span>
            <select value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
              {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        <div className="hero-trend" style={{ color: model.trend.color }}>
          <span className="tri">{arrow}</span> {model.trend.text}
        </div>
        <div className="hero-sub muted">{scopeLabel} · {year} ({yearRangeLabel})</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="hero-spark" role="img"
           aria-label={`Monthly ${noun}, ${year} versus ${year - 1}`}>
        {spark.prevPath && <path d={spark.prevPath} fill="none" stroke="#c7ccd1" strokeWidth={1.5} />}
        <path d={spark.latPath} fill="none" stroke={accent.dark} strokeWidth={2.4} />
        <circle cx={spark.dotX} cy={spark.dotY} r={3.6} fill={accent.dark} />
        <text x={spark.dotX} y={spark.dotY - 8} textAnchor="end" fontSize="12" fontWeight="600" fill={ink.secondary}>
          {fmtK(model.latestTotal)}
        </text>
        <g transform={`translate(0,${H - M.bottom + 2})`}>
          {months.map((mo, i) => (
            <text key={mo} x={spark.x(i)} y={10} textAnchor="middle" fontSize="6.5"
                  fill={i === lastMonthIdx ? ink.secondary : "#b8bfc6"}>{mo}</text>
          ))}
        </g>
      </svg>
    </div>
  );
}

function prvNull(prv) {
  return !prv || prv.every((v) => v === 0);
}
