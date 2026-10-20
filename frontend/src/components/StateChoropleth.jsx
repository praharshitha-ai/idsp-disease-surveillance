import { useMemo } from "react";
import * as d3 from "d3";
import { accent, magnitudeColor, ramp } from "../theme.js";
import { showTip, moveTip, hideTip } from "../lib/tooltip.js";

const W = 620;
const H = 660;

// State-wise cases map on the dissolved state layer (india_states.geojson, ~37
// polygons). Each feature carries `data_state`; fill = that state's total
// (green->red, log). Click a state to open the State-level tab.
export default function StateChoropleth({ geojson, stateTotals, onPickState }) {
  const { path, color, max } = useMemo(() => {
    const projection = d3.geoMercator().fitSize([W, H], geojson);
    const path = d3.geoPath(projection);
    const max = d3.max([...stateTotals.values()]) || 1;
    return { path, color: magnitudeColor(max), max };
  }, [geojson, stateTotals]);

  return (
    <div className="map-box">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="State-wise reported cases map">
        <g>
          {geojson.features.map((f, i) => {
            const st = f.properties.data_state;
            const total = stateTotals.get(st) || 0;
            return (
              <path
                key={`${st}-${i}`}
                d={path(f)}
                fill={total > 0 ? color(total) : accent.noData}
                stroke="#ffffff"
                strokeWidth={0.5}
                style={{ cursor: onPickState ? "pointer" : "default" }}
                onMouseEnter={(e) => showTip(`<b>${st}</b><br/>Cases: ${d3.format(",")(total)}`, e)}
                onMouseMove={moveTip}
                onMouseLeave={hideTip}
                onClick={() => onPickState && onPickState(st)}
              />
            );
          })}
        </g>
      </svg>
      <Legend color={color} max={max} />
    </div>
  );
}

function Legend({ color, max }) {
  const stops = d3.range(0, 1.0001, 0.1);
  const gradient = `linear-gradient(to right, ${stops.map((t) => color(1 + t * (max - 1))).join(",")})`;
  return (
    <div className="legend" style={{ marginTop: 8 }}>
      <span>low</span>
      <span className="bar" style={{ background: gradient }} />
      <span>{d3.format(",")(Math.round(max))} cases (log)</span>
    </div>
  );
}
