# india_shp_2020

District-level administrative boundaries for India (2020 vintage). The source
data ships **37 separate per-state/UT shapefiles**; this repo merges them once
into a single, analysis-ready national layer of **735 districts** (2011 Census +
LGD codes preserved), with a scripted, verified build.

![District boundaries of India](images/in_district_shp.png)

## Data

`district/in_district.shp` — 735 districts · 37 states/UTs · WGS 84 (EPSG:4326),
merged from the per-state files in `district/states/`.

| Field | Type | Description |
|-------|------|-------------|
| `dtname`    | text | District name |
| `stname`    | text | State / Union Territory name |
| `stcode11`  | text | 2011 Census state code (2-digit) |
| `dtcode11`  | text | 2011 Census district code (3-digit, within state) |
| `year_stat` | text | Boundary vintage / update status (`2011_c`, `2018`, `2019`, …) |
| `Dist_LGD`  | num  | District code, Local Government Directory |
| `State_LGD` | num  | State code, Local Government Directory |
| `JID`       | num  | Unique row identifier (merge key) |

> **Vintage & scope.** A 2020 snapshot on India's *official* boundary claim (not
> an internationally neutral depiction). India has ~800 districts and 36
> states/UTs today; this layer has 735 / 37. See [DATA_SOURCE.md](DATA_SOURCE.md).

## Layout

```
india_shp_2020/
├── code/
│   ├── in_district_shp.R              # merge 37 state files -> national layer
│   ├── make_figures.R                 # render the reference map
│   └── make_current.R                 # download current GADM -> district/current/ (git-ignored)
├── district/
│   ├── in_district.{shp,shx,dbf,prj}  # MERGED OUTPUT (735 districts, static 2020 snapshot)
│   └── states/                        # 37 source files (India_District_NN_XX.*)
├── images/
│   ├── in_district_shp.png            # static 2020 reference map
│   └── in_district_current.png        # current GADM map (make_current.R)
├── renv.lock                          # pinned R + package versions
├── CITATION.cff
└── DATA_SOURCE.md                     # provenance & licensing
```

## Reproduce

```r
renv::restore()                    # install pinned packages (R 4.5.3)
source("code/in_district_shp.R")   # rebuild the merged layer (checks 735 / unique JID / CRS)
source("code/make_figures.R")      # render images/in_district_shp.png
```

Paths use `here::here()`, so the scripts run from anywhere in the repo.

## Static snapshot vs. current

The committed layer (`district/in_district.*`, mapped at the top) is a
deliberately fixed **2020 snapshot** on India's official boundary claim.
`code/make_current.R` auto-detects and downloads the latest **GADM** release for
an up-to-date, internationally neutral (*de-facto*) view:

![Current district boundaries from GADM](images/in_district_current.png)

The two layers differ in **currency** — GADM 4.1 carries 676 districts across 36
states/UTs, versus 735 / 37 here — and in **depiction**: the official layer
follows India's claim, GADM follows *de-facto* control. The GADM **data** may not
be redistributed and is
git-ignored; `source("code/make_current.R")` regenerates it locally. The map
above is a GADM-derived figure shown with attribution. This repository takes no
territorial position: boundaries and names shown do not imply endorsement or
acceptance by the author of any claim.

## Source & license

Boundaries are redistributed from
[justinelliotmeyers/India_Official_Boundaries_2019](https://github.com/justinelliotmeyers/India_Official_Boundaries_2019)
(official Government of India units). Code (`code/`) is [MIT](LICENSE); the
boundary data is third-party with no upstream license — verify terms before
redistribution. See [DATA_SOURCE.md](DATA_SOURCE.md).

## Citation

[CITATION.cff](CITATION.cff), or GitHub's "Cite this repository" button. Issues:
[github.com/abhatia08/india_shp_2020/issues](https://github.com/abhatia08/india_shp_2020/issues)
