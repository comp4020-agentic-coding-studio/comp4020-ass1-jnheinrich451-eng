import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { fanBands, heroTrails } from "../fan";

// Contracts for the Hero, not implementation details — these should survive
// a rewrite of the three.js scene itself. See spec/README.md.
const doc = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8")).window
  .document;

function numbersIn(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe("hero section", () => {
  it("has a full-viewport hero and an observatory section to scroll to", () => {
    expect(doc.getElementById("hero")).toBeTruthy();
    expect(doc.getElementById("observatory")).toBeTruthy();
  });

  it("titles the page BLINDSPOTS", () => {
    const h1 = doc.querySelector("h1");
    expect(h1?.textContent?.trim()).toBe("BLINDSPOTS");
  });

  it("has an enter-observatory control that jumps to the observatory section", () => {
    const link = doc.querySelector(".enter-observatory");
    expect(link?.getAttribute("href")).toBe("#observatory");
  });

  it("hides both decorative fans from assistive tech", () => {
    const fans = Array.from(doc.querySelectorAll(".deco-fan"));
    expect(fans).toHaveLength(2);
    for (const fan of fans) {
      expect(fan.getAttribute("aria-hidden")).toBe("true");
    }
  });

  // The paths are literal in the markup so the page needs no JS to draw its own
  // artwork — but literal numbers drift. These two tests are what stop that:
  // they re-derive every path from fan.ts and compare numerically, so any
  // hand-edit to index.html fails the build instead of silently shipping.
  function expectFanMatches(selector: string, bands: ReturnType<typeof fanBands>) {
    const svg = doc.querySelector(selector);
    const paths = svg ? Array.from(svg.querySelectorAll("path")) : [];
    expect(paths).toHaveLength(bands.length);
    paths.forEach((path, i) => {
      const band = bands[i];
      expect(numbersIn(path.getAttribute("d") ?? "")).toEqual(
        numbersIn(band.d).map((n) => expect.closeTo(n, 1)),
      );
      expect(path.getAttribute("fill")?.toUpperCase()).toBe(
        band.fill.toUpperCase(),
      );
    });
  }

  it("ships page 1's curved trails exactly as heroTrails() generates them (STRIPE.md §A)", () => {
    expectFanMatches("#hero .deco-fan", heroTrails());
  });

  it("ships page 2's landed V exactly as fanBands() generates it (STRIPE.md §B)", () => {
    expectFanMatches("#observatory .deco-fan", fanBands());
  });

  // The whole point of two geometries sharing one anchor set: page 1's trails
  // must leave the bottom edge at exactly the x-values page 2's boundaries
  // enter the top edge at, or the seam visibly steps at every window width.
  it("matches the two fans at the page seam (STRIPE.md §A.4)", () => {
    const W = 1600;
    const H = 1000;
    const N = 6;
    const P = 1.1;
    const heroBottoms = Array.from(
      { length: N + 1 },
      (_, k) => (W / 2) * (1 - Math.pow(k / N, P)),
    );
    const observatoryTops = Array.from(
      { length: N + 1 },
      (_, k) => (W / 2) * (1 - Math.pow(1 - k / N, P)),
    );
    expect([...heroBottoms].sort((a, b) => a - b)).toEqual(
      observatoryTops.map((n) => expect.closeTo(n, 6)),
    );

    // …and the endpoints of both are actually in the shipped markup.
    const heroD = Array.from(
      doc.querySelectorAll("#hero .deco-fan path"),
      (p) => p.getAttribute("d") ?? "",
    ).join(" ");
    const obsD = Array.from(
      doc.querySelectorAll("#observatory .deco-fan path"),
      (p) => p.getAttribute("d") ?? "",
    ).join(" ");
    for (const x of [145.38, 287.86, 426.79, 561.08, 688.54]) {
      expect(heroD).toContain(`${x} ${H}`);
      expect(obsD).toContain(`${x} 0`);
    }
  });
});
