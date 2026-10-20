// Shared design tokens.
// Magnitude is encoded with a GREEN -> RED ramp for clear low/high variation
// (green = few cases, red = many). Note: green/red is not colorblind-safe, so
// every magnitude mark is paired with a value label or tooltip.
import * as d3 from "d3";

export const ink = {
  primary: "#0f172a",
  secondary: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  grid: "rgba(15,23,42,0.06)",
  surface: "#ffffff",
  page: "#f6f7f9",
  border: "#e2e8f0",
};

// Green (low) -> yellow -> red (high). Reversed RdYlGn.
// Lowest counts sit at #1a9850 (medium green) and climb toward red.
export const ramp = ["#1a9850", "#66bd63", "#a6d96a", "#fee08b", "#fc8d59", "#d73027"];

// Neutral series accent for time-series lines (not a magnitude encoding).
export const accent = {
  base: "#0f766e",
  dark: "#134e4a",
  fill: "rgba(15,118,110,0.14)",
  noData: "#c8f2dd", // zero reported cases — a pale green, lighter than the low-count #1a9850
};
export const amber = "#b45309"; // forecast mean, distinct from history

// Log magnitude color scale over the green->red ramp.
export function magnitudeColor(max) {
  return d3.scaleSequentialLog(d3.interpolateRgbBasis(ramp)).domain([1, Math.max(2, max || 2)]);
}
