import { useEffect, useMemo } from "react";
import ForecastChart from "../components/ForecastChart.jsx";
import Dropdown from "../components/Dropdown.jsx";

const sum = (a) => a.reduce((x, y) => x + y, 0);

// Single-district view: state + district dropdowns and one yearly timeline
// forecast line chart. Nothing else.
export default function DistrictView({ ts, disease, insights, stateFilter, setStateFilter, districtFilter, setDistrictFilter }) {
  const stateDistricts = useMemo(
    () => ts.districts.filter((d) => d.state === stateFilter).sort((a, b) => a.district.localeCompare(b.district)),
    [ts, stateFilter]
  );

  // Keep the district selection valid: default to the state's highest-cases district.
  useEffect(() => {
    if (!stateDistricts.length) return;
    if (!stateDistricts.some((d) => d.code === districtFilter)) {
      const top = [...stateDistricts].sort((a, b) => sum(b.cases) - sum(a.cases))[0];
      setDistrictFilter(top.code);
    }
  }, [stateDistricts, districtFilter, setDistrictFilter]);

  const rec = stateDistricts.find((d) => d.code === districtFilter);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{rec ? rec.district : "—"}{rec ? `, ${stateFilter}` : ""} — {disease}</h1>
          <p>Yearly reported cases with a short-term forecast. Choose a state and district.</p>
        </div>
        <div className="head-controls">
          <div className="field">
            <span>State</span>
            <Dropdown ariaLabel="State" value={stateFilter}
                      options={ts.states.map((s) => ({ value: s, label: s }))}
                      onChange={(v) => { setStateFilter(v); setDistrictFilter(null); }} />
          </div>
          <div className="field">
            <span>District</span>
            <Dropdown ariaLabel="District" value={districtFilter}
                      options={stateDistricts.map((d) => ({ value: d.code, label: d.district }))}
                      onChange={(v) => setDistrictFilter(v)} placeholder="Select district…" />
          </div>
        </div>
      </div>

      <div className="card full" style={{ marginTop: 18 }}>
        <h2>Cases over time &amp; forecast — {rec ? rec.district : "—"}</h2>
        <p className="card-sub">Yearly reported {disease} cases (Holt linear-trend forecast, next 2 years, ~80% band). The most recent year is partial and excluded from the fit.</p>
        {rec ? (
          <ForecastChart years={ts.years} cases={rec.cases}
                         maxYear={insights.maxYear} maxMonthIdx={insights.maxMonthIdx} />
        ) : (
          <p className="card-sub" style={{ padding: 24 }}>No data for this selection.</p>
        )}
      </div>
    </>
  );
}
