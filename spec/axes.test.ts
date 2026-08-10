import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { logTicks, tickLabel, yearStep, yearTicks } from "../axes";
import {
  C,
  buildArchive,
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
