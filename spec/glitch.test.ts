import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// GLITCH.md's contracts. The animations themselves can only be judged in a
// browser, but the things that go wrong silently — a smoothed timing function, a
// block that plays its exit on mount, invented copy where dataset text belongs —
// are all checkable here.
const doc = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8")).window
  .document;
const dir = resolve("dist/assets");
const cssFile = readdirSync(dir).find((f) => f.endsWith(".css"));
const css = cssFile ? readFileSync(resolve(dir, cssFile), "utf8") : "";

describe("glitch reveal (GLITCH.md)", () => {
  it("ships four code blocks, empty in the markup", () => {
    const blocks = ["c1", "c2", "c3", "c4"].map((id) =>
      doc.getElementById(`glitch-${id}`),
    );
    for (const block of blocks) {
      expect(block).toBeTruthy();
      // Empty on purpose: every line is written by glitch.ts from the archive.
      // Text here would be frozen copy, which §2 forbids outright.
      expect(block?.textContent?.trim()).toBe("");
    }
  });

  // §4: read-only, unselectable, never interactive.
  it("keeps the blocks out of the pointer and the accessibility tree", () => {
    expect(
      doc.querySelector(".glitch-blocks")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(css).toMatch(/\.glitch-block\{[^}]*pointer-events:none/);
    expect(css).toMatch(/\.glitch-block\{[^}]*user-select:none/);
  });

  // These read the BUILT css, which the minifier normalises: steps(1) ships as
  // its keyword synonym step-end, a 0ms delay is dropped, and 220ms becomes
  // .22s. So parse the shorthand rather than matching its source spelling — an
  // assertion against the source text passes only until the minifier changes
  // its mind.
  const usesOf = (keyframe: string) =>
    (css.match(/animation:[^;}]*/g) ?? []).filter((d) => d.includes(keyframe));
  const times = (decl: string) =>
    (decl.match(/(?<![\w.])-?\d*\.?\d+m?s/g) ?? []).map((t) =>
      t.endsWith("ms") ? Number.parseFloat(t) : Number.parseFloat(t) * 1000,
    );

  // §3 rule 1. A smoothed clip-path is a wipe, and this is the single easiest
  // thing to lose in a refactor — it still animates, it just stops tearing.
  it("uses steps(1) on every glitch animation, never an easing", () => {
    const uses = [
      ...usesOf("glitch-in-slice"),
      ...usesOf("glitch-out-slice"),
    ];
    expect(uses.length).toBe(8); // four in, four out
    for (const use of uses) {
      // step-end IS steps(1); anything with a cubic-bezier or an ease is not.
      expect(use).toMatch(/steps\(1\)|step-end/);
      expect(use).not.toMatch(/ease|cubic-bezier|linear/);
    }
  });

  // §3.1/§3.2: uneven entry delays read as four independent feeds arriving; a
  // flat exit stagger reads as one gesture leaving.
  it("staggers entry unevenly and exit evenly", () => {
    // times[0] is the duration, times[1] the delay — absent means 0.
    const delays = (keyframe: string) =>
      usesOf(keyframe).map((d) => times(d)[1] ?? 0);
    expect(delays("glitch-in-slice")).toEqual([0, 90, 145, 220]);
    expect(delays("glitch-out-slice")).toEqual([0, 40, 80, 120]);
  });

  // §1: the three-value state. `null` is "never touched", and if the exit is not
  // gated on a touched flag every block plays its exit animation on mount.
  it("gates the exit on the page having been touched at all", () => {
    expect(css).toMatch(/\.cta-touched:not\(\.cta-hover\) #glitch-c1\{/);
    // ...and the entry is gated on the hover class, not on :hover, so the state
    // survives focus as well as pointer.
    expect(css).toMatch(/\.cta-hover #glitch-c1\{/);
  });

  // §3.2: `both`, not `forwards`, or the block is visible during its exit delay.
  it("holds the exit's first frame through its delay", () => {
    for (const use of css.match(/animation:glitch-out-slice [^;}]*/g) ?? []) {
      expect(use).toMatch(/\bboth\b/);
      expect(use).not.toMatch(/\bforwards\b/);
    }
  });

  // §2.3: violet/amber, explicitly NOT the red/cyan RGB-split cliché — which
  // would also collide with the trail palette.
  it("splits the fringe violet and amber, not red and cyan", () => {
    // Minified to hex+alpha: a855f7 is rgb(168,85,247), eab308 is rgb(234,179,8).
    const shadow = css.match(/\.glitch-block\{[^}]*text-shadow:([^;}]*)/)?.[1] ?? "";
    expect(shadow).toMatch(/#a855f7/i); // violet, left
    expect(shadow).toMatch(/#eab308/i); // amber, right
  });
});

describe("archive data (GLITCH.md §2)", () => {
  const archive = JSON.parse(
    readFileSync(resolve("assets/exoplanets.json"), "utf8"),
  );

  it("carries the full archive, not a sample", () => {
    expect(archive.rows).toHaveLength(6336);
    expect(archive.source).toBe("PSCompPars_2026.08.08_10.48.26.csv");
  });

  it("carries the 20 CSV column names c1 prints", () => {
    expect(archive.csvCols).toHaveLength(20);
    expect(archive.csvCols[0]).toBe("pl_name");
    expect(archive.csvCols).toContain("discoverymethod");
  });

  // The flags are the reason the generator exists: they are not derivable from
  // `method`, so a row carrying two of them proves they came from the CSV rather
  // than from the discovery method.
  it("carries detection flags that disagree with the discovery method", () => {
    expect(archive.flags).toHaveLength(archive.rows.length);
    const multi = archive.flags.filter(
      (f: number) => ((f >> 0) & 1) + ((f >> 1) & 1) + ((f >> 2) & 1) + ((f >> 3) & 1) > 1,
    );
    expect(multi.length).toBeGreaterThan(0);
  });

  it("counts every record under exactly one discovery method", () => {
    const method = archive.cols.indexOf("method");
    const counts = new Map<number, number>();
    for (const row of archive.rows) {
      counts.set(row[method], (counts.get(row[method]) ?? 0) + 1);
    }
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(6336);
    expect(counts.size).toBeLessThanOrEqual(archive.methods.length);
  });
});
