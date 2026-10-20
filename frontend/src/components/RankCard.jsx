import * as d3 from "d3";
import { ramp } from "../theme.js";

const fmt = d3.format(",");

// Compact card noting the highest- and lowest-cases entity (state or district)
// for the current scope + time period.
export default function RankCard({ title, period, high, low, unit = "state" }) {
  return (
    <div className="kpi rank">
      <div className="label" style={{ marginBottom: 6 }}>{title} · {period}</div>
      <Row tone={ramp[ramp.length - 1]} tag="Highest" rec={high} unit={unit} />
      <Row tone={ramp[0]} tag="Lowest" rec={low} unit={unit} />
    </div>
  );
}

function Row({ tone, tag, rec, unit }) {
  return (
    <div className="rank-row">
      <span className="dot" style={{ background: tone }} />
      <span className="rank-tag">{tag}</span>
      {rec ? (
        <>
          <span className="rank-name" title={rec.name}>{rec.name}</span>
          <span className="rank-val">{fmt(rec.cases)}</span>
        </>
      ) : (
        <span className="rank-name" style={{ color: "#94a3b8" }}>no {unit} with cases</span>
      )}
    </div>
  );
}
