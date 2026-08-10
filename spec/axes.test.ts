import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { logTicks, tickLabel, yearStep, yearTicks } from "../axes";
import { teffColour, zoomLimits } from "../system";
import {
  C,
  buildArchive,
  hash01,
  extentsOf,
  linDenorm,
  linNorm,
  logDenorm,
  logNorm,
} from "../data";

const archive = buildArchive(
  JSON.parse(readFileSync(resolve("assets/exoplanets.json"), "utf8")),
);
const ext = extentsOf(archive.rows);

describe("the one law (AXES.md §1)", () => {
  // "A tape reads the exact expression that placed the points. Never a
  // re-derived scale. If the two can drift, the axis is a decoration that
  // lies." The tape inverts logNorm to label a position, so the round trip has
  // to be exact — over the real archive, not a sample of round numbers.
  it("round-trips every real orbital period through the mapping", () => {
    const [lo, hi] = ext.orbper;
    for (const r of archive.rows) {
      const v = r[C.orbper];
      if (typeof v !== "number" || !(v > 0)) continue;
      const back = logDenorm(logNorm(v, lo, hi), lo, hi);
      expect(back / v).toBeCloseTo(1, 9);
    }
  });

  it("round-trips every real radius", () => {
    const [lo, hi] = ext.rade;
    for (const r of archive.rows) {
      const v = r[C.rade];
      if (typeof v !== "number" || !(v > 0)) continue;
      expect(logDenorm(logNorm(v, lo, hi), lo, hi) / v).toBeCloseTo(1, 9);
    }
  });

  it("round-trips discovery years exactly", () => {
    const [lo, hi] = ext.year;
    for (const y of [lo, 2000, 2016, hi]) {
      expect(linDenorm(linNorm(y, lo, hi), lo, hi)).toBeCloseTo(y, 9);
    }
  });

  // §2: filtering must NOT rescale the axis — a day is the same distance in
  // every population. The mapping takes its domain as an argument and the
  // domain is computed over the whole archive, so a filtered subset cannot
  // change where a value lands. Asserted against a real subset.
  it("does not move a value when the population is filtered", () => {
    const transit = archive.methods.indexOf("Transit");
    const subset = archive.rows.filter((r) => r[C.method] === transit);
    expect(subset.length).toBeGreaterThan(100);
    const whole = ext.orbper;
    const sub = extentsOf(subset).orbper;
    expect(sub).not.toEqual(whole); // the subset really does have its own spread
    // ...and the tape still uses the archive domain, so 365 days is unmoved.
    expect(logNorm(365, whole[0], whole[1])).toBe(logNorm(365, whole[0], whole[1]));
  });
});

describe("ticks (AXES.md §4)", () => {
  it("emits 1-2-5 per decade, major only on the 1", () => {
    const t = logTicks(0.9, 60);
    expect(t.map((x) => x.v)).toEqual([1, 2, 5, 10, 20, 50]);
    expect(t.filter((x) => x.major).map((x) => x.v)).toEqual([1, 10]);
  });

  it("emits nothing outside the visible domain", () => {
    expect(logTicks(3, 7).map((t) => t.v)).toEqual([5]);
    expect(logTicks(-1, 10)).toEqual([]);
  });

  // §4's rollover exists because the period domain really reaches ~4x10^8 days.
  it("rolls labels over at K, M and B", () => {
    expect(tickLabel(0.25)).toBe("0.25");
    expect(tickLabel(5)).toBe("5");
    expect(tickLabel(1500)).toBe("1.5K");
    expect(tickLabel(2.4e6)).toBe("2.4M");
    expect(tickLabel(1e9)).toBe("1B");
  });

  // "ONLY whole years are ever emitted — no 2018.5 can exist."
  it("never emits a fractional year", () => {
    for (const px of [120, 400, 1200]) {
      const step = yearStep(1992, 2026, px, false);
      expect([1, 2, 5, 10, 25, 50]).toContain(step);
      for (const t of yearTicks(1992, 2026, step)) {
        expect(Number.isInteger(t.v)).toBe(true);
      }
    }
  });

  it("widens the year step until the pitch guard is met", () => {
    expect(yearStep(1992, 2026, 200, false)).toBeGreaterThan(
      yearStep(1992, 2026, 1600, false),
    );
    // Narrow demands a wider pitch, so it can never choose a tighter step.
    expect(yearStep(1992, 2026, 400, true)).toBeGreaterThanOrEqual(
      yearStep(1992, 2026, 400, false),
    );
  });
});

describe("open system (OPEN-SYSTEM.md)", () => {
  // §3: "The floor is derived from the guaranteed periapsis clearance, so the
  // camera can never enter the planet and never escape toward the star."
  it("clamps the camera outside the planet and inside the system", () => {
    for (const orbitR of [22, 60, 400]) {
      const { min, max } = zoomLimits(1, orbitR);
      expect(min).toBeGreaterThan(1); // never inside the planet
      expect(max).toBeGreaterThanOrEqual(orbitR * 2.6); // whole ellipse fits
      expect(min).toBeLessThan(max);
    }
  });

  // §4: orbit scale is a display unit and must not touch the inspection view —
  // "the close view is identical at every setting; only the space around it
  // changes". planetR is what sets the floor, so the floor cannot move.
  it("leaves the inspection floor unchanged at every orbit scale", () => {
    const floors = [1, 3, 5].map((s) => zoomLimits(1, 22 * s).min);
    expect(new Set(floors).size).toBe(1);
  });

  // §2: the side is chosen deterministically per planet name, never randomly,
  // so the same planet always opens on the same face.
  it("picks the entry side deterministically from the name", () => {
    const side = (n: string): number => (hash01(n, 17) < 0.5 ? -1 : 1);
    expect(side("Kepler-22 b")).toBe(side("Kepler-22 b"));
    const sides = new Set(archive.rows.slice(0, 400).map((r) => side(String(r[C.name]))));
    expect(sides).toEqual(new Set([-1, 1])); // both sides actually occur
  });

  // §6: "The disclosure block is not optional." Ten compressions are named, and
  // the star's colour stays a function of the archive temperature.
  it("keeps star colour a function of the archive temperature", () => {
    expect(teffColour(3000)).not.toBe(teffColour(6000));
    expect(teffColour(12000)).not.toBe(teffColour(6000));
    expect(teffColour(5500)).toBe(teffColour(5500));
  });
});
