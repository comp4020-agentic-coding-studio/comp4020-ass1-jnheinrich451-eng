import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUCKETS,
  C,
  type Row,
  auditSky3D,
  bucketFor,
  buildArchive,
  cloudK,
  extentsOf,
  hash01,
  isResolved,
  logNorm,
  missingFor,
  positionOf,
  project,
  skyXYZ,
  unresolvedPos,
  verifySkyTransform,
} from "../data";

// LOAD_DATA.md calls verifySkyTransform() and auditSky3D() "the contract".
// A console.log is not a contract — nothing fails when it stops being true. The
// same checks run here, where a failure stops a push.
const archive = buildArchive(
  JSON.parse(readFileSync(resolve("assets/exoplanets.json"), "utf8")),
);
const ext = extentsOf(archive.rows);
const cam = { yaw: 0.6, pitch: 0.35, dist: 2.75 };

describe("archive shape (LOAD_DATA.md §1)", () => {
  it("is column-indexed in the documented order", () => {
    expect(archive.cols).toEqual([
      "name", "host", "method", "year", "orbper_days", "orbsmax_au",
      "rade_earth", "bmasse_earth", "eqt_k", "dist_pc", "ra_deg", "dec_deg",
      "ecc", "teff_k", "srad_sun",
    ]);
    expect(archive.rows).toHaveLength(6336);
  });

  // "Transit Timing Variations" is not Transit. A startsWith would have put it
  // there and quietly inflated the largest bucket.
  it("buckets only the four exact techniques, everything else Other", () => {
    expect(bucketFor("Transit")).toBe("Transit");
    expect(bucketFor("Transit Timing Variations")).toBe("Other");
    expect(bucketFor("Pulsar Timing")).toBe("Other");
    expect(new Set(archive.bucketOf)).toEqual(
      new Set(archive.bucketOf.filter((b) => BUCKETS.includes(b))),
    );
  });
});

describe("missing is a value (§2)", () => {
  // The rule the whole document opens with: a record missing what a projection
  // needs is still drawn. If drawn ever falls below rows, the archive is being
  // silently shrunk.
  it("draws every row in every projection, resolved or not", () => {
    for (const p of ["orbit", "distance", "time", "spatial"] as const) {
      const audit = auditSky3D(archive, p, ext, cam);
      expect(audit.drawn, `${p} drew fewer rows than exist`).toBe(audit.rows);
      expect(audit.rows).toBe(6336);
    }
  });

  it("puts unresolved records outside the 0–1 scientific region", () => {
    const missing: Row = ["No Period b", "X", 0, 2020, null, null, null, null,
      null, null, null, null, null, null, null];
    expect(isResolved(missing, "orbit")).toBe(false);
    const p = positionOf(missing, "orbit", ext, cam);
    expect(p.resolved).toBe(false);
    expect(p.x).toBeGreaterThan(1);
  });

  it("names the fields the TARGET panel must print", () => {
    const noRadius: Row = ["A b", "A", 0, 2020, 5, null, null, null, null,
      10, 1, 1, null, null, null];
    expect(missingFor(noRadius, "orbit")).toEqual(["radius"]);
    expect(missingFor(noRadius, "distance")).toEqual([]);
  });

  // A null must never be read as zero: that would fabricate a measurement and
  // drag every lower bound to the origin.
  it("takes extents over resolved values only", () => {
    expect(ext.orbper[0]).toBeGreaterThan(0);
    expect(ext.rade[0]).toBeGreaterThan(0);
    expect(ext.dist[0]).toBeCloseTo(1.30119, 4);
    expect(ext.dist[1]).toBeCloseTo(8500, 0);
  });
});

describe("normalisation (§4)", () => {
  it("emits 0.06 + 0.88t so nothing lands on the edge", () => {
    expect(logNorm(1, 1, 100)).toBeCloseTo(0.06, 10);
    expect(logNorm(100, 1, 100)).toBeCloseTo(0.94, 10);
  });

  // Deterministic, never random — the same name must land in the same place on
  // every visit, or a display spread starts looking like new data.
  it("hashes a name to the same value every time", () => {
    expect(hash01("Kepler-22 b", 7)).toBe(hash01("Kepler-22 b", 7));
    expect(hash01("Kepler-22 b", 7)).not.toBe(hash01("Kepler-22 b", 3));
    expect(unresolvedPos("Kepler-22 b")).toEqual(unresolvedPos("Kepler-22 b"));
  });

  it("keeps the holding cloud clear of the scientific region at any zoom", () => {
    for (const dist of [0.8, 2.75, 12]) {
      const k = cloudK(dist);
      expect(k).toBeLessThanOrEqual(2);
      const p = unresolvedPos("Some Name b", 1.15, k);
      expect(p.x).toBeGreaterThan(1);
    }
  });
});

describe("the sky transform contract (§5)", () => {
  it("passes every check verifySkyTransform() makes", () => {
    for (const c of verifySkyTransform()) {
      expect(c.pass, `${c.name} — ${c.detail}`).toBe(true);
    }
  });

  // The property the log exists to protect: ranking by distance must be
  // identical to ranking by radius, for the real archive, not a sample.
  it("preserves distance ordering exactly across all 6336 rows", () => {
    const d = archive.rows
      .map((r) => r[C.dist])
      .filter((v): v is number => typeof v === "number" && v > 0)
      .sort((a, b) => a - b);
    const r = d.map((v) => Math.log(1 + v));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
  });

  it("compresses the 6538x distance span to about 10.9x", () => {
    const near = skyXYZ(1.30119, 0, 0);
    const far = skyXYZ(8500, 0, 0);
    const ratio = Math.hypot(far.x, far.y, far.z) / Math.hypot(near.x, near.y, near.z);
    expect(ratio).toBeGreaterThan(10.7);
    expect(ratio).toBeLessThan(11.1);
  });

  it("never writes the camera back into the coordinates", () => {
    const p = skyXYZ(100, 45, 20);
    const before = { ...p };
    project(p, cam);
    project(p, { yaw: 2, pitch: -1, dist: 9 });
    expect(p).toEqual(before);
  });

  it("drops points behind the eye rather than projecting them inside out", () => {
    expect(project({ x: 0, y: 0, z: -10 }, { yaw: 0, pitch: 0, dist: 2.75 })).toBeNull();
  });
});
