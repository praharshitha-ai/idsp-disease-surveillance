import * as d3 from "d3";

// Indices of the years within [range0, range1].
export const yearIdx = (years, range) =>
  years.map((y, i) => [y, i]).filter(([y]) => y >= range[0] && y <= range[1]).map(([, i]) => i);

// {code: {district, state, cases, deaths, outbreaks}} summed over the year range,
// optionally restricted to one state.
export function districtAgg(tsDistricts, idx, stateFilter) {
  const out = {};
  for (const d of tsDistricts) {
    if (stateFilter && d.state !== stateFilter) continue;
    out[d.code] = {
      district: d.district,
      state: d.state,
      cases: d3.sum(idx, (i) => d.cases[i]),
      deaths: d3.sum(idx, (i) => d.deaths[i]),
      outbreaks: d3.sum(idx, (i) => d.outbreaks[i]),
    };
  }
  return out;
}

// Roll district rows up to state totals over the year range.
export function stateAgg(tsDistricts, idx) {
  const m = new Map();
  for (const d of tsDistricts) {
    const cases = d3.sum(idx, (i) => d.cases[i]);
    const deaths = d3.sum(idx, (i) => d.deaths[i]);
    const e = m.get(d.state) || { state: d.state, cases: 0, deaths: 0, districts: 0 };
    e.cases += cases;
    e.deaths += deaths;
    if (cases > 0) e.districts += 1;
    m.set(d.state, e);
  }
  return [...m.values()];
}

// Highest / lowest by `key`, considering only positive values.
export function extremes(items, key = (d) => d.cases) {
  const nz = items.filter((i) => key(i) > 0).sort((a, b) => key(b) - key(a));
  return { high: nz[0] ?? null, low: nz[nz.length - 1] ?? null, count: nz.length };
}

// Top N and bottom N (positive only), highest-first for both lists' bars.
export function topBottom(items, n = 10, key = (d) => d.cases) {
  const nz = items.filter((i) => key(i) > 0).sort((a, b) => key(b) - key(a));
  const top = nz.slice(0, n);
  const bottom = nz.slice(Math.max(0, nz.length - n)).reverse(); // smallest first
  return { top, bottom, count: nz.length };
}
