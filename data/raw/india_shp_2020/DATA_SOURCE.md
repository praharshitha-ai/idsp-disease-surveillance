# Data source & provenance

## Source

Boundaries are redistributed from **India Official Boundaries 2019**
(<https://github.com/justinelliotmeyers/India_Official_Boundaries_2019>). The 37
per-state/UT files in `district/states/` are official Government of India units,
keyed by 2011 Census codes (`stcode11`, `dtcode11`) and LGD codes (`Dist_LGD`,
`State_LGD`). `code/in_district_shp.R` merges them by positional `rbind` after a
schema check — no geometries edited, verified lossless (37 files → 735 rows).

## Territorial depiction

These are India's **official** boundaries: their external extent reflects the
Government of India's claim, not de-facto administrative control, and so differs
from internationally neutral datasets such as GADM. The difference is observable,
not asserted here — compare the two maps in the README and see
`district/current/name_diff.csv`.

Boundaries and names shown do not imply endorsement or acceptance by the author
of any territorial claim.

## Vintage & currency

`year_stat` records each unit's boundary vintage (`2011_c` … `2019`), reflecting
units current to ~2019–2020 (Ladakh already a separate UT, `stcode11 = 37`).

**This 2020 snapshot is now out of date.** As of 2025 India has ~800 districts
and 36 units (28 states + 8 UTs); this layer has 735 / 37. It predates the Dadra
& Nagar Haveli + Daman & Diu merger (26 Jan 2020; still separate codes 25, 26),
Andhra Pradesh's 13→26 split (2022), Ladakh's 2→7 split (2024), and new districts
in Rajasthan, Chhattisgarh, Assam, and others. Post-2011 districts have no Census
code — `Dist_LGD` / `State_LGD` is the current key.

## Updating this layer

No source is at once current, openly redistributable, **and** on India's claim
line — pick about two of three:

| Source | Currency | License | Depiction |
|--------|----------|---------|-----------|
| This repo (justinelliotmeyers) | 2020 · 735 districts | none stated | India claim |
| Survey of India ABDB | current | ₹0 but registration + **no redistribution** | India claim |
| GADM | partial post-2020 | free, **non-commercial** | de facto |
| geoBoundaries ADM2 | reasonably current | **CC-BY 4.0** | de facto |
| OpenStreetMap (`admin_level=5`) | most current | **ODbL** | de facto |

`code/make_current.R` resolves this by auto-downloading the latest **GADM**
release (currently 4.1 = 676 districts, 36 units; neutral *de facto*). GADM may
not be redistributed, so `data/gadm/` and `district/current/` are git-ignored —
regenerate locally. The repo takes **no territorial position**: each layer
reflects its source.

## CRS & licensing

Geographic WGS 84 (EPSG:4326); for area/distance, reproject or use geodesic
`sf::st_area()` / `sf::st_distance()`. Code (`code/`) is MIT ([LICENSE](LICENSE));
the boundary data is third-party with no stated upstream license — verify terms
before redistribution and cite the source.
