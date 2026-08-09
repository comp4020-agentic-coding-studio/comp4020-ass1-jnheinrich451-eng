import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { fanBands } from "../fan";

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

  it("hides the decorative scout-trail fan from assistive tech", () => {
    const svg = doc.querySelector(".deco-fan");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("ships the scout-trail fan exactly as fanBands() generates it (STRIPE.md)", () => {
    const svg = doc.querySelector(".deco-fan");
    const paths = svg ? Array.from(svg.querySelectorAll("path")) : [];
    const bands = fanBands(1600, 1000, 6, 1.1, true);
    expect(paths).toHaveLength(bands.length);
    paths.forEach((path, i) => {
      const band = bands[i];
      expect(numbersIn(path.getAttribute("d") ?? "")).toEqual(
        numbersIn(band.d).map((n) => expect.closeTo(n, 0)),
      );
      expect(path.getAttribute("fill")?.toUpperCase()).toBe(
        band.fill.toUpperCase(),
      );
    });
  });
});
