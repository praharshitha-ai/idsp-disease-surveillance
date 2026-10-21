"""Export multi-disease surveillance data to JSON for the React/D3 frontend.

Canonicalises the messy raw disease names into diseases, keeps those above a case
threshold (the "top 20 with >10k cases"), and writes per-disease data files so the
dashboard can load one disease at a time.

Outputs in frontend/public/data/:
  - india_districts.geojson  : all districts (shared, disease-independent)
  - india_states.geojson     : dissolved/authoritative state polygons (shared)
  - diseases.json            : {diseases:[{name,slug,totalCases}], meta:{...}}
  - diseases/<slug>.json      : per disease {districts[], states[], insights{}}
"""
import json
import math
import re
import warnings
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
import shapefile  # pyshp
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.geometry.polygon import orient

warnings.simplefilter("ignore", FutureWarning)

ROOT = Path(__file__).resolve().parents[1]
CLEAN = ROOT / "data" / "processed" / "idsp_clean.csv"
GEOJSON = ROOT / "data" / "processed" / "india_districts.geojson"
STATE_SHP = ROOT / "data" / "raw" / "india_state_2020" / "India_State_Boundary"
OUTDIR = ROOT / "frontend" / "public" / "data"
DISEASE_DIR = OUTDIR / "diseases"

ALL_SCOPE = "All India"
MIN_CASES = 10_000   # keep diseases above this total
MAX_DISEASES = 20    # ... capped at the top 20
MAP_PRECISION = 2
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

STATE_ALIASES = {
    "chhattishgarh": "Chhattisgarh",
    "damananddiuanddadraandnagarhaveli": "Dadra and Nagar Haveli",
}
_WEB_MERCATOR_R = 6378137.0

# Raw name (lowercased) -> canonical disease. First matching substring wins.
CANON_RULES = [
    ("hepatitis", "Hepatitis"), ("jaundice", "Hepatitis"),
    ("food poisoning", "Food Poisoning"),
    ("diarrhea", "Acute Diarrheal Disease"), ("diarrhoea", "Acute Diarrheal Disease"),
    ("gastroenteritis", "Gastroenteritis"), ("dysentery", "Gastroenteritis"),
    ("cholera", "Cholera"),
    ("swine flu", "Swine Flu (H1N1)"), ("h1n1", "Swine Flu (H1N1)"),
    ("malaria", "Malaria"),
    ("chickenpox", "Chickenpox"), ("varicella", "Chickenpox"),
    ("measles", "Measles"), ("rubella", "Measles"),
    ("dengue", "Dengue"), ("chikungunya", "Chikungunya"),
    ("encephalit", "Acute Encephalitis Syndrome"),
    ("mumps", "Mumps"),
    ("typhoid", "Typhoid/Enteric Fever"), ("enteric fever", "Typhoid/Enteric Fever"),
    ("scrub typhus", "Scrub Typhus"),
    ("leptospir", "Leptospirosis"),
    ("diphtheria", "Diphtheria"),
    ("viral fever", "Viral Fever"),
]


def canon(name):
    n = str(name).lower()
    for key, val in CANON_RULES:
        if key in n:
            return val
    return str(name).strip().title()


def slugify(name):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


# ---------- shared geometry helpers ----------
def _round(c):
    if isinstance(c[0], (int, float)):
        return [round(v, MAP_PRECISION) for v in c]
    return [_round(v) for v in c]


def load_geo():
    gj = json.load(open(GEOJSON, encoding="utf-8"))
    code2state, feats = {}, []
    for f in gj["features"]:
        st = f["properties"]["stname"].title()
        code2state[f["id"]] = st
        g = f.get("geometry")
        if g and g.get("coordinates"):
            g["coordinates"] = _round(g["coordinates"])
        feats.append({"type": "Feature", "id": f["id"],
                      "properties": {"dtname": f["properties"]["dtname"], "stname": st},
                      "geometry": g})
    out = {"type": "FeatureCollection", "features": feats}
    (OUTDIR / "india_districts.geojson").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    return len(feats), code2state


def _merc_to_lonlat(x, y):
    return [math.degrees(x / _WEB_MERCATOR_R),
            math.degrees(2 * math.atan(math.exp(y / _WEB_MERCATOR_R)) - math.pi / 2)]


def _reproject(coords):
    if isinstance(coords[0], (int, float)):
        return _merc_to_lonlat(coords[0], coords[1])
    return [_reproject(c) for c in coords]


def _norm(s):
    return re.sub(r"[^a-z]", "", s.lower())


def _ring_area(r):
    return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2.0


def _rewind_geom(geom):
    t, c = geom.get("type"), geom.get("coordinates")
    if not c:
        return geom

    def fix_poly(poly):
        rings = []
        for i, ring in enumerate(poly):
            if len(ring) < 4 or abs(_ring_area(ring)) < 1e-7:
                continue
            want_cw = i == 0
            is_cw = _ring_area(ring) < 0
            rings.append(ring[::-1] if is_cw != want_cw else ring)
        return rings

    if t == "Polygon":
        geom["coordinates"] = fix_poly(c)
    elif t == "MultiPolygon":
        geom["coordinates"] = [fp for poly in c if (fp := fix_poly(poly))]
    return geom


def _orient(g):
    if g.geom_type == "Polygon":
        return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon":
        return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g


def export_states(states):
    dnorm = {_norm(s): s for s in states}
    r = shapefile.Reader(str(STATE_SHP))
    feats = []
    for sr in r.iterShapeRecords():
        name = sr.record[0]
        geo = sr.shape.__geo_interface__
        if geo.get("coordinates"):
            geo = {**geo, "coordinates": _reproject(geo["coordinates"])}
        g = shape(geo)
        if not g.is_valid:
            g = g.buffer(0)
        g = _orient(g.simplify(0.01, preserve_topology=True))
        n = _norm(name)
        data_state = dnorm.get(n) or STATE_ALIASES.get(n) or name
        feats.append({"type": "Feature",
                      "properties": {"state": name, "data_state": data_state},
                      "geometry": mapping(g)})
    out = json.loads(json.dumps({"type": "FeatureCollection", "features": feats}))
    for f in out["features"]:
        g = f["geometry"]
        if g and g.get("coordinates"):
            g["coordinates"] = _round(g["coordinates"])
            f["geometry"] = _rewind_geom(g)
    (OUTDIR / "india_states.geojson").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    matched = sum(1 for f in feats if f["properties"]["data_state"] in set(states))
    return len(feats), matched


# ---------- per-disease data ----------
def disease_districts(sub, years):
    d = sub.dropna(subset=["district_lgd_code", "year"]).copy()
    d["code"] = d["district_lgd_code"].astype(int)
    d["year"] = d["year"].astype(int)
    districts = []
    for code, grp in d.groupby("code"):
        by = grp.groupby("year").agg(cases=("cases", "sum"), deaths=("deaths", "sum"),
                                     outbreaks=("cases", "size"))
        districts.append({
            "code": int(code), "district": grp["district"].iloc[0], "state": grp["state"].iloc[0],
            "cases": [float(by["cases"].get(y, 0)) for y in years],
            "deaths": [float(by["deaths"].get(y, 0)) for y in years],
            "outbreaks": [int(by["outbreaks"].get(y, 0)) for y in years],
        })
    states = sorted(d["state"].dropna().unique().tolist())
    return districts, states


def _month_series(d):
    """Month (1-12) for each row: the outbreak start month, falling back to the
    epi-week, then January — so no row is dropped and monthly sums per year equal
    the yearly totals used everywhere else."""
    ds = pd.to_datetime(d["outbreak_starting_date"], errors="coerce")
    wk = pd.to_numeric(d.get("week"), errors="coerce")
    mo_week = (((wk - 1) * 12 // 53) + 1).clip(1, 12)
    mo = ds.dt.month
    # Rows are filed under their IDSP (epidemiological) year, but the outbreak can start
    # in the calendar year before or after it. Without this, an outbreak that began in
    # late December 2025 and was reported in week 1 of 2026 was counted as December 2026.
    yr = pd.to_numeric(d.get("year"), errors="coerce")
    mo = mo.mask(ds.dt.year < yr, 1).mask(ds.dt.year > yr, 12)
    return mo.fillna(mo_week).fillna(1).astype(int)


def disease_insights(sub, states, years):
    # Same rows and same year attribution as disease_districts, so the hero card's
    # yearly totals match the map, rankings, KPIs and chatbot exactly.
    d = sub.dropna(subset=["district_lgd_code", "year"]).copy()
    d["year"] = d["year"].astype(int)
    d["mo"] = _month_series(d).values

    def scope(s):
        out = {}
        for y in years:
            sy = s[s["year"] == y]
            if sy.empty:
                continue
            out[str(y)] = [float(sy.loc[sy["mo"] == m, "cases"].sum()) for m in range(1, 13)]
        return out

    scopes = {ALL_SCOPE: scope(d)}
    for st in states:
        scopes[st] = scope(d[d["state"] == st])
    return scopes


def build_crosswalk(df, code2state):
    d = df.dropna(subset=["district_lgd_code"]).copy()
    d["code"] = d["district_lgd_code"].astype(int)
    cross = defaultdict(Counter)
    for state, code in zip(d["state"], d["code"]):
        geo = code2state.get(code)
        if geo:
            cross[state][geo] += 1
    return {ds: sorted(geos) for ds, geos in cross.items()}


def main():
    OUTDIR.mkdir(parents=True, exist_ok=True)
    DISEASE_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(CLEAN)
    df["cases"] = pd.to_numeric(df["cases"], errors="coerce")
    df["deaths"] = pd.to_numeric(df["deaths"], errors="coerce")
    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    df["disease"] = df["disease_illness_name"].map(canon)

    # Shared layers + global meta.
    n_geo, code2state = load_geo()
    all_states = sorted(df["state"].dropna().unique().tolist())
    n_st, matched = export_states(all_states)
    crosswalk = build_crosswalk(df, code2state)

    yr = df.dropna(subset=["year"])["year"].astype(int)
    years = list(range(int(yr.min()), int(yr.max()) + 1))
    max_year = int(yr.max())
    latest = df[df["year"] == max_year]
    max_month_idx = int(_month_series(latest).max()) - 1  # last month with data in the latest year

    # Pick diseases: total cases > MIN_CASES, top MAX_DISEASES.
    totals = df.groupby("disease")["cases"].sum().sort_values(ascending=False)
    chosen = totals[totals > MIN_CASES].head(MAX_DISEASES)

    disease_index = []
    for name, total in chosen.items():
        sub = df[df["disease"] == name]
        districts, states = disease_districts(sub, years)
        insights = disease_insights(sub, states, years)
        slug = slugify(name)
        payload = {"disease": name, "slug": slug, "states": states,
                   "districts": districts, "insights": {"scopes": insights}}
        (DISEASE_DIR / f"{slug}.json").write_text(json.dumps(payload), encoding="utf-8")
        disease_index.append({"name": name, "slug": slug, "totalCases": int(round(total)),
                              "stateCount": len(states)})

    meta = {"years": years, "months": MONTHS, "maxYear": max_year,
            "maxMonthIdx": max_month_idx, "crosswalk": crosswalk, "allStates": all_states}
    (OUTDIR / "diseases.json").write_text(json.dumps({"diseases": disease_index, "meta": meta}), encoding="utf-8")

    print(f"india_districts.geojson : {n_geo} districts")
    print(f"india_states.geojson    : {n_st} polygons, {matched} matched")
    print(f"diseases                : {len(disease_index)} diseases (> {MIN_CASES:,} cases)")
    for d in disease_index:
        print(f"    {d['totalCases']:>8}  {d['name']}  ({d['stateCount']} states) -> {d['slug']}.json")
    print(f"-> {OUTDIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
