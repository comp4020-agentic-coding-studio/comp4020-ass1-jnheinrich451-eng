import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// SCOUT-SHIP.md's contracts. The crossing itself has to be watched in a
// browser, but the timing algebra is exact and checkable here — and it is the
// part that carries the brief's "after the complete vanish, 5 seconds, then it
// returns the other way".
const doc = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8")).window
  .document;
const dir = resolve("dist/assets");
const cssFile = readdirSync(dir).find((f) => f.endsWith(".css"));
const css = cssFile ? readFileSync(resolve(dir, cssFile), "utf8") : "";

describe("scout ships (SCOUT-SHIP.md)", () => {
  it("ships exactly two scouts, never more (§6)", () => {
    expect(doc.querySelectorAll(".scout")).toHaveLength(2);
    expect(doc.querySelector(".scout-top")).toBeTruthy();
    expect(doc.querySelector(".scout-bot")).toBeTruthy();
  });

  it("gives each one all five layers (§3)", () => {
    for (const anchor of Array.from(doc.querySelectorAll(".scout"))) {
      for (const layer of [
        "scout-glow",
        "scout-core",
        "scout-flash",
        "scout-hull",
        "scout-spark",
      ]) {
        expect(anchor.querySelector(`.${layer}`)).toBeTruthy();
      }
    }
  });

  it("hides them from assistive tech — they are weather, not content", () => {
    expect(doc.querySelector(".scout-top")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(doc.querySelector(".scout-behind")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  // §4: the lower route goes behind the globe by a punched hole, not by
  // z-ordering — and it is the *wrapper* that carries the mask, so the anchor
  // inside can still translate freely.
  it("puts only the lower route inside the globe cut-out", () => {
    const wrapper = doc.querySelector(".scout-behind");
    expect(wrapper?.querySelector(".scout-bot")).toBeTruthy();
    expect(wrapper?.querySelector(".scout-top")).toBeNull();
    const rule = css.match(/\.scout-behind\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("radial-gradient");
    // 1.04, not 1.00: a hairline of clearance so the trail never grazes the
    // silhouette. Sized from the globe's measured radius, so it tracks resizes.
    expect(rule).toMatch(/--mars-px[^)]*\)?\s*\*\s*1\.04/);
  });

  // §2's algebra, which is also the brief's: 41.67% of 60s is 25s of crossing,
  // the second run starts at 50% = 30s, so the gap between them is 5s — and the
  // second ends at 91.67% = 55s, 5s before the cycle restarts. If any of these
  // three numbers drift, the "5 seconds later it comes back" reads as wrong
  // without looking obviously broken.
  it("leaves exactly 5 seconds between the two passes, both ways", () => {
    const CYCLE = 60;
    const rtlEnd = 0.4167 * CYCLE;
    const ltrStart = 0.5 * CYCLE;
    const ltrEnd = 0.9167 * CYCLE;
    expect(ltrStart - rtlEnd).toBeCloseTo(5, 1);
    expect(CYCLE - ltrEnd).toBeCloseTo(5, 1);
    // ...and those percentages are the ones actually shipped.
    expect(css).toMatch(/@keyframes scout-rtl\{[^@]*41\.67%/);
    expect(css).toMatch(/@keyframes scout-ltr\{[^@]*91\.67%/);
  });

  it("runs one shared 60s linear cycle, so the two never overlap (§2)", () => {
    for (const name of ["scout-rtl", "scout-ltr"]) {
      const use = css.match(new RegExp(`animation:[^;}]*${name}[^;}]*`))?.[0] ?? "";
      expect(use).toContain("60s");
      expect(use).toContain("linear");
      expect(use).toContain("infinite");
      // §2: "these have no engines to accelerate; easing would make them look
      // like UI".
      expect(use).not.toMatch(/ease|cubic-bezier/);
    }
  });

  // §2: the travel distances are what make the vanish COMPLETE. The trail is
  // 66vw and extends forward of the anchor, so -66vw puts its tail at the left
  // edge and 166vw puts the mirrored one's tail at the right edge. Short by even
  // a few vw and the trail is still on screen during the "empty" gap.
  it("travels far enough for the trail to clear the frame entirely", () => {
    // The minifier rewrites translateX(...) to the equivalent translate(...),
    // so match either spelling rather than the one in the source.
    expect(css).toMatch(/@keyframes scout-rtl\{[^@]*translate(X)?\(-66vw\)/);
    expect(css).toMatch(/@keyframes scout-ltr\{[^@]*translate(X)?\(166vw\)/);
    const trail = css.match(/\.scout-glow\{[^}]*\}/)?.[0] ?? "";
    expect(trail).toContain("66vw");
  });

  // §3.1: the gradients run VERTICALLY across a 2-7px height, which is what
  // makes a 2px line read as incandescent gas. A 90deg gradient here would look
  // almost right and be completely wrong.
  it("runs both trail gradients across the trail, not along it", () => {
    for (const layer of ["scout-glow", "scout-core"]) {
      const rule = css.match(new RegExp(`\\.${layer}\\{[^}]*\\}`))?.[0] ?? "";
      // 180deg is the CSS default for linear-gradient, so the minifier drops it.
      expect(rule).toMatch(/background:linear-gradient\((?!\d+deg|to )/);
      expect(rule).toContain("mask-image:linear-gradient(90deg");
    }
  });

  // §6: park them, do not slow them. A scout at reduced speed is still
  // continuous motion, which is the thing being opted out of.
  it("parks both off-screen under prefers-reduced-motion", () => {
    const block = css.match(/@media \(prefers-reduced-motion:reduce\)\{.*\}/s)?.[0] ?? "";
    expect(block).toMatch(/\.scout-top,\.scout-bot\{[^}]*animation:none/);
    expect(block).toMatch(/\.scout-top,\.scout-bot\{[^}]*translate(X)?\(-200vw\)/);
  });
});
