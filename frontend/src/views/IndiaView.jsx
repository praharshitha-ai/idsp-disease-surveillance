import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import HeroInsight from "../components/HeroInsight.jsx";
import StateChoropleth from "../components/StateChoropleth.jsx";
import ForecastChart from "../components/ForecastChart.jsx";
import RankBar from "../components/RankBar.jsx";
import RankCard from "../components/RankCard.jsx";
import { yearIdx, stateAgg, extremes, topBottom } from "../lib/agg.js";
import { magnitudeColor } from "../theme.js";

const fmt = d3.format(",");

// Default to the latest complete year (the most recent year is partial).
const defaultYear = (ins) => (ins.maxMonthIdx >= 11 ? ins.maxYear : ins.maxYear - 1);

// National overview: hero (year filter) + state-wise map + top / lowest 10 states.
export default function IndiaView({ ts, disease, stateGeo, insights, onPickState }) {
  const years = ts.years;
  const [year, setYear] = useState(defaultYear(insights));
  useEffect(() => { setYear(defaultYear(insights)); }, [insights]);

  const idx = useMemo(() => yearIdx(years, [year, year]), [years, year]);

  const states = useMemo(() => stateAgg(ts.districts, idx), [ts, idx]);
  const stateTotals = useMemo(() => new Map(states.map((s) => [s.state, s.cases])), [states]);
  const stItems = useMemo(() => states.map((s) => ({ key: s.state, label: s.state, cases: s.cases })), [states]);
  const { top, bottom, count } = useMemo(() => topBottom(stItems, 10), [stItems]);
  const stMax = useMemo(() => d3.max(stItems, (d) => d.cases) || 1, [stItems]);
  const stColor = useMemo(() => magnitudeColor(stMax), [stMax]);
  const [selState, setSelState] = useState(null);

  const stExt = useMemo(() => extremes(states.map((s) => ({ name: s.state, cases: s.cases }))), [states]);
  const totalDeaths = d3.sum(states, (s) => s.deaths);

  // National yearly totals for the forecast (independent of the year filter).
  const casesByYear = useMemo(() => years.map((_, i) => d3.sum(ts.districts, (d) => d.cases[i])), [ts, years]);

  return (
    <>
      <div className="view-head">
        <h1>India — {disease}</h1>
        <p>Reported {disease} outbreaks nationwide (IDSP surveillance). Pick a year in the card below; click a state on the map or a bar to open its dashboard.</p>
      </div>

      <HeroInsight monthlyByYear={insights.scopes["All India"]} months={insights.months}
                   years={insights.years} maxYear={insights.maxYear} maxMonthIdx={insights.maxMonthIdx}
                   year={year} onYearChange={setYear} scopeLabel="All India" noun="Cases" />

      <section className="kpi-row">
        <Kpi value={fmt(Math.round(totalDeaths))} label={`Total deaths · ${year}`} />
        <RankCard title="States" period={String(year)} unit="state" high={stExt.high} low={stExt.low} />
      </section>

      <div className="grid grid--map">
        <div className="card">
          <h2>Cases by state · {year}</h2>
          <p className="card-sub">Green→red (log), light green = 0. Click a state to open its district-level dashboard.</p>
          {stateGeo && <StateChoropleth geojson={stateGeo} stateTotals={stateTotals} onPickState={onPickState} />}
        </div>
        <div className="stack">
          <div className="card">
            <h2>Top 10 states · {year}</h2>
            <p className="card-sub">Highest reported cases. Click to open a state.</p>
            <RankBar items={top} colorScale={stColor} selected={selState} onSelect={(k) => k && onPickState(k)} />
          </div>
          <div className="card">
            <h2>Lowest 10 states · {year}</h2>
            <p className="card-sub">Fewest among {count} states reporting any {disease}.</p>
            <RankBar items={bottom} colorScale={stColor} selected={selState} onSelect={(k) => k && onPickState(k)}
                     emptyNote={`No states reported ${disease} in ${year}.`} />
          </div>
        </div>
      </div>

      <div className="card full" style={{ marginTop: 18 }}>
        <h2>Cases over time &amp; forecast — All India</h2>
        <p className="card-sub">Yearly reported {disease} cases with a 2-year forecast (Holt linear trend, ~80% band). Independent of the year filter above.</p>
        <ForecastChart years={years} cases={casesByYear} maxYear={insights.maxYear} maxMonthIdx={insights.maxMonthIdx} />
      </div>
    </>
  );
}

function Kpi({ value, label }) {
  return (
    <div className="kpi">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
