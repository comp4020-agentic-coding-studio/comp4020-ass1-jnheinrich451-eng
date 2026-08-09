import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Contracts for the Hero, not implementation details — these should survive
// a rewrite of the three.js scene itself. See spec/README.md.
const doc = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8")).window
  .document;

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

  it("gives decorative images empty alt text, not missing alt text", () => {
    for (const img of doc.querySelectorAll(".deco-stripes, .deco-horizontal")) {
      expect(img.getAttribute("alt")).toBe("");
    }
  });
});
