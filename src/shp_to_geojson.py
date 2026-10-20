"""Convert the merged India district shapefile (india_shp_2020) to GeoJSON.

Source : data/raw/india_shp_2020/in_district.shp  (735 districts, EPSG:4326)
Output : data/processed/india_districts.geojson    (ready for Plotly/pydeck)

Uses pyshp only (pure Python) so no GDAL/geopandas is required. The source .prj
is already WGS 84 (EPSG:4326), which is what Plotly/pydeck expect, so geometry
is passed through unchanged. Each feature's `id` is set to the LGD district code
(`Dist_LGD`) to line up with `district_lgd_code` in idsp_clean.csv.
"""
import json
from pathlib import Path

import shapefile  # pyshp

ROOT = Path(__file__).resolve().parents[1]
SHP = ROOT / "data" / "raw" / "india_shp_2020" / "in_district.shp"
OUT = ROOT / "data" / "processed" / "india_districts.geojson"

# Coordinate decimal places kept. 4 dp ~= 11 m at the equator, far finer than a
# national district choropleth needs, and it shrinks the file dramatically vs.
# full float precision. This trims vertex *precision*, not vertex *count* (pyshp
# can't do topology-preserving simplification); for a heavier reduction, run the
# raw .shp through mapshaper/geopandas later.
PRECISION = 4


def _round(coords):
    """Recursively round the nested coordinate arrays of a GeoJSON geometry."""
    if isinstance(coords[0], (int, float)):
        return [round(c, PRECISION) for c in coords]
    return [_round(c) for c in coords]


def main() -> None:
    reader = shapefile.Reader(str(SHP))
    fields = [f[0] for f in reader.fields[1:]]  # drop DeletionFlag

    features = []
    for sr in reader.iterShapeRecords():
        rec = dict(zip(fields, list(sr.record)))
        geom = sr.shape.__geo_interface__
        if geom.get("coordinates"):
            geom = {**geom, "coordinates": _round(geom["coordinates"])}
        features.append(
            {
                "type": "Feature",
                "id": rec.get("Dist_LGD"),
                "properties": rec,
                "geometry": geom,
            }
        )

    fc = {"type": "FeatureCollection", "features": features}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, separators=(",", ":"))  # no whitespace

    size_mb = OUT.stat().st_size / 1e6
    print(f"Wrote {len(features)} districts -> {OUT.relative_to(ROOT)} "
          f"({size_mb:.1f} MB, {PRECISION} dp)")


if __name__ == "__main__":
    main()
