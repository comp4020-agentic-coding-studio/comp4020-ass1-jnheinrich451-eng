# SECTION 2 — DATA PROCESS FORMULA
*From the archive export to a lit pixel. Every step is stated so no step can
quietly invent a value.*
Connected to: all five other section-2 documents.

---

## 1. SOURCE

`exoplanets.json`, NASA Exoplanet Archive `pscomppars`, fetched once at mount.
Column-indexed rows (compact, no per-row objects):

```
0 pl_name   1 hostname  2 method#  3 disc_year  4 pl_orbper  5 pl_orbsmax
6 pl_rade   7 pl_bmasse 8 pl_eqt   9 sy_dist    10 ra_deg    11 dec_deg
12 pl_orbeccen 13 st_teff 14 st_rad
```
`methods[]` is a shared string table; `bucketOf[]` maps every method index to
one of Transit / Radial Velocity / Imaging / Microlensing / **Other**.

Method colours: `#e8c37a` Transit · `#9fc4ff` Radial Velocity ·
`#c79bff` Imaging · `#ffffff` Microlensing · `#6c7699` Other.

## 2. MISSING IS A VALUE

`null` is never coerced. A record missing what a projection needs is
**UNRESOLVED**, and it is drawn — in a holding cloud, outside the scientific
region — not dropped. Dropping it would silently shrink the archive; mapping it
to 0 would fabricate a measurement.

## 3. REQUIRED FIELDS PER PROJECTION

| projection | required (positive where noted) |
|---|---|
| ORBIT × SIZE | orbper > 0, rade > 0 |
| EARTH DISTANCE | dist_pc > 0 |
| SPATIAL | ra, dec, dist_pc > 0 |
| DISCOVERY TIME | disc_year |

`missingFor()` returns the human labels; the TARGET panel prints them.

## 4. THE FOUR MAPPINGS (normalised 0–1 space)

```
ORBIT × SIZE     x = logNorm(orbper)          y = 1 − logNorm(rade)
DISCOVERY TIME   x = linNorm(disc_year)       y = 0.08 + 0.84·hash01(name,7)   ← display only
EARTH DISTANCE   r = logNorm(1+dist)·0.46     θ = hash01(name,3)·2π            ← θ display only
                 x = 0.5 + r cosθ             y = 0.5 + r sinθ
SPATIAL          scientific XYZ → perspective camera (below)
```
`logNorm/linNorm` both emit `0.06 + 0.88·t`.
`hash01` is FNV-1a with a salt → a name always yields the same angle/spread.
**Deterministic, never random**, and never fed back into stored coordinates.

**Holding cloud** — `unresolvedPos(name, cx, k)`: a disc of radius
`0.072k × 0.15k` around `cx` (default 1.15), i.e. deliberately outside the
0–1 scientific region. The fit rect widens to 1.26 only when a projection
actually has unresolved records.

## 5. SPATIAL — the scientific transform

```
r = ln(1 + dist_pc)                       monotonic, so ordering is exact
x = r·cos(dec)·cos(ra)
y = r·sin(dec)
z = r·cos(dec)·sin(ra)
```
Radius is log-compressed, not linear: raw distance spans 1.30 → 8500 pc, and a
linear radius collapses 99% of the archive into the origin. Ratio 6538× becomes
10.9×; ordering and ranking survive exactly, absolute spacing does not.
A point is the **host system**, not the planet's own measured position.

Camera: yaw about +Y, then pitch about +X, at `dist` on the view axis, always
looking at the origin (SOL); `f = 1/tan(24°)`, screen `0.5 ± 0.45·f··/ze`.
The camera never writes back into the coordinates.
Holding cloud drifts outward on `k = min(√(2.75/dist), 2)` — the square root,
so a real net dolly survives while the two clouds stay separated at any zoom.

`verifySkyTransform()` and `auditSky3D()` log a pass/fail table and a coverage
report to the console. Keep them: they are the contract.

## 6. COVERAGE GLYPH

Four groups — orbit · size · mass · temperature — rendered `●`/`○` in FIND rows
and always mirrored into `aria-label`. It answers "what can this record even be
drawn with", which is a different question from "is it a good planet".

## 7. RENDER PASS (one canvas, ordered)

```
1  clear, DPR ≤ 2
2  furniture (rings, holding-cloud ellipse, annotations) — under the points
3  every row:  r = 2.0 px (matched) | 1.2 px (dimmed)
               α = 0.8            | 0.1
               × zoom gain  zg = 1 + min(1.1, (zoom−1)·0.34)
               × depth cue  clamp(camDist/depth, 0.45, 1.5)      SPATIAL only
4  HUD tapes                                    (SECTION2-AXES.md)
5  marked records — held back and painted LAST
6  furniture that must sit above points
```
Step 5 exists because in a dense region the selected point was being overpainted
by every later index — exactly where CENTER TARGET sends you.

Marked mark: dark bed `rgba(3,4,10,0.82)` at r+15 (sel) / r+7 (hover), the dot
at 3.8/3.2 px × zoom gain, then rings — selected `#fff` 1.3px at r+6 plus
`rgba(255,255,255,.32)` at r+13; hover, one method-coloured ring at r+5.

## 8. MORPH BETWEEN PROJECTIONS

- Interpolates from the **currently drawn** positions, so rapid switching never
  teleports or duplicates a record.
- After-image: only the most recent slice of the path, capped at 22px, alpha
  ×0.2 (0.34 selected), on a `sin(π·p)` envelope so nothing persists at either
  end. Instrument persistence, not a velocity vector.
- Depth cue is itself interpolated (1.0 = no cue), so it fades in and out with
  the projection that owns it instead of switching in one frame.
- `prefers-reduced-motion` → instant switch, no trail, no eased frame.

## 9. FILTER TRANSITION

Radius and alpha interpolate between the previous filter's targets and the new
ones on one clock (`ft`). No record is removed from the draw loop, ever.
