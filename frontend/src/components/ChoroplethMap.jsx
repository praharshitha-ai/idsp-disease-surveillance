import { useMemo } from "react";
import * as d3 from "d3";
import { accent, magnitudeColor } from "../theme.js";
import { showTip, moveTip, hideTip } from "../lib/tooltip.js";

const W = 640;
const H = 660;

// Choropleth of total reported cases per district.
// Color = single-hue teal sequential on a LOG scale (counts span 0 -> ~5.6k;
// a linear ramp would collapse everything but Kerala). Zero-report districts
// are drawn in a neutral "no data" grey, kept off the ramp.
// NOTE: paths are rendered by React (not d3 data-join), so selection styling is
// driven by props here — never by d3.select().selectAll() over these elements.
export default function ChoroplethMap({ geojson, districts, onSelect, selected }) {
  const { path, color, maxCases } = useMemo(() => {
    const projection = d3.geoMercator().fitSize([W, H], geojson);
    const path = d3.geoPath(projection);
    const values = Object.values(districts).map((d) => d.cases).filter((v) => v > 0);
    const maxCases = d3.max(values) || 1;
    const color = magnitudeColor(maxCases);
    return { path, color, maxCases };
  }, [geojson, districts]);

  const fill = (code) => {
    const rec = districts[code];
    return rec && rec.cases > 0 ? color(rec.cases) : accent.noData;
  };

  return (
    <div className="map-box">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
           aria-label="Map of reported cases by district">
        <g>
          {geojson.features.map((f, i) => {
            const isSel = f.id === selected;
            return (
              <path
                key={`${f.id}-${i}`}
                d={path(f)}
                fill={fill(f.id)}
                stroke={isSel ? "#0f172a" : "#ffffff"}
                strokeWidth={isSel ? 1.4 : 0.4}
                style={{ cursor: "pointer", transition: "fill 0.15s" }}
                onMouseEnter={(e) => {
                  const r = districts[f.id];
                  showTip(
                    `<b>${f.properties.dtname}</b>, ${f.properties.stname}<br/>` +
                      (r
                        ? `Cases: ${d3.format(",")(r.cases)}<br/>Deaths: ${d3.format(",")(
                            r.deaths
                          )}<br/>Outbreaks: ${r.outbreaks}`
                        : "No cases reported"),
                    e
                  );
                }}
                onMouseMove={moveTip}
                onMouseLeave={hideTip}
                onClick={() => onSelect && onSelect(isSel ? null : f.id)}
              />
            );
          })}
        </g>
      </svg>
      <Legend color={color} max={maxCases} />
    </div>
  );
}

function Legend({ color, max }) {
  const stops = d3.range(0, 1.0001, 0.1);
  const gradient = `linear-gradient(to right, ${stops
    .map((t) => color(1 + t * (max - 1)))
    .join(",")})`;
  return (
    <div className="legend" style={{ marginTop: 8 }}>
      <span>1</span>
      <span className="bar" style={{ background: gradient }} />
      <span>{d3.format(",")(Math.round(max))} cases (log)</span>
    </div>
  );
}
