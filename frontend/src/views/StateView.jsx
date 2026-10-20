import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import HeroInsight from "../components/HeroInsight.jsx";
import ChoroplethMap from "../components/ChoroplethMap.jsx";
import ForecastChart from "../components/ForecastChart.jsx";
import Dropdown from "../components/Dropdown.jsx";
import RankBar from "../components/RankBar.jsx";
import RankCard from "../components/RankCard.jsx";
import { yearIdx, districtAgg, extremes, topBottom } from "../lib/agg.js";
import { magnitudeColor } from "../theme.js";

const fmt = d3.format(",");
const defaultYear = (ins) => (ins.maxMonthIdx >= 11 ? ins.maxYear : ins.maxYear - 1);

// Per-state deep dive: hero (year filter) + zoomed district map + top / lowest 10 districts.
export default function StateView({ districtGeo, ts, disease, insights, stateFilter, setStateFilter, onOpenDistrict }) {
  const years = ts.years;
  const [year, setYear] = useState(defaultYear(insights));
  useEffect(() => { setYear(defaultYear(insights)); }, [insights]);

  const idx = useMemo(() => yearIdx(years, [year, year]), [years, year]);

  // State yearly totals for the forecast (independent of the year filter).
  const casesByYear = useMemo(
    () => years.map((_, i) => d3.sum(ts.districts.filter((d) => d.state === stateFilter), (d) => d.cases[i])),
    [ts, years, stateFilter]
  );

  const districts = useMemo(() => districtAgg(ts.districts, idx, stateFilter), [ts, idx, stateFilter]);
  const distItems = useMemo(
    () => Object.entries(districts).map(([code, r]) => ({ key: +code, label: r.district, cases: r.cases })),
    [districts]
  );
  const { top, bottom, count } = useMemo(() => topBottom(distItems, 10), [distItems]);
  const distMax = useMemo(() => d3.max(distItems, (d) => d.cases) || 1, [distItems]);
  const distColor = useMemo(() => magnitudeColor(distMax), [distMax]);
  const dExt = useMemo(() => extremes(distItems.map((d) => ({ name: d.label, cases: d.cases }))), [distItems]);

  const geojson = useMemo(() => {
    if (!districtGeo?.data) return null;
    const geoNames = new Set(ts.crosswalk[stateFilter] ?? []);
    return { type: "FeatureCollection", features: districtGeo.data.features.filter((f) => geoNames.has(f.properties.stname)) };
  }, [districtGeo, ts, stateFilter]);

  const totalDeaths = d3.sum(Object.values(districts), (r) => r.deaths);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{stateFilter} — {disease}</h1>
          <p>District-level reported {disease} for the selected state. Pick a year in the card below.</p>
        </div>
        <div className="field">
          <span>State</span>
          <Dropdown ariaLabel="State" value={stateFilter}
                    options={ts.states.map((s) => ({ value: s, label: s }))}
                    onChange={setStateFilter} />
        </div>
      </div>

      <HeroInsight monthlyByYear={insights.scopes[stateFilter]} months={insights.months}
                   years={insights.years} maxYear={insights.maxYear} maxMonthIdx={insights.maxMonthIdx}
                   year={year} onYearChange={setYear} scopeLabel={stateFilter} noun="Cases" />

      <section className="kpi-row">
        <Kpi value={fmt(Math.round(totalDeaths))} label={`Total deaths · ${year}`} />
        <RankCard title="Districts" period={String(year)} unit="district" high={dExt.high} low={dExt.low} />
      </section>

      <div className="card full">
        <h2>Cases by district — {stateFilter} · {year}</h2>
        <p className="card-sub">Green→red (log), light green = 0. Click any district to open its metrics in the District tab.</p>
        {districtGeo?.loading ? (
          <p className="card-sub" style={{ padding: 24 }}>Loading district boundaries…</p>
        ) : geojson && geojson.features.length > 0 ? (
          <ChoroplethMap key={stateFilter} geojson={geojson} districts={districts} selected={null}
                         onSelect={(c) => c && onOpenDistrict(c)} />
        ) : (
          <p className="card-sub" style={{ padding: 24 }}>No 2020 boundary available for this state’s districts.</p>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <h2>Top 10 districts · {year}</h2>
          <p className="card-sub">Highest reported cases in {stateFilter}.</p>
          <RankBar items={top} colorScale={distColor} selected={null} onSelect={(k) => k && onOpenDistrict(k)}
                   emptyNote={`No reported ${disease} in ${stateFilter} for ${year}.`} />
        </div>
        <div className="card">
          <h2>Lowest 10 districts · {year}</h2>
          <p className="card-sub">Fewest among {count} districts reporting any {disease}.</p>
          <RankBar items={bottom} colorScale={distColor} selected={null} onSelect={(k) => k && onOpenDistrict(k)} emptyNote="—" />
        </div>
      </div>

      <div className="card full" style={{ marginTop: 18 }}>
        <h2>Cases over time &amp; forecast — {stateFilter}</h2>
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
