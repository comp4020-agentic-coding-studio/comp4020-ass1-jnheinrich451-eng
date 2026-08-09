import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { fanBands, heroTrails } from "../fan";
import { inFanGround, observatoryStars } from "../starfield";

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
  // STRIPE.md §A.2.1 states two checks explicitly. Encoding them means the top
  // region can't quietly start expanding again the way it did when p1/p2 carried
  // per-boundary easing.
  describe("band geometry (STRIPE.md §A.2.1)", () => {
    const W = 1600;
    const H = 1000;
    const N = 6;
    const P = 1.1;
    const GAP = 70 / 6;
    const OV = 40;

    // x of boundary k at viewBox y, straight from the shipped generator's maths.
    const xAt = (k: number, y: number) => {
      const cx = W / 2;
      const top = cx - GAP * k;
      const bottom = cx - cx * Math.pow(k / N, P);
      const u = (y + OV) / (H + OV);
      return top + (bottom - top) * u ** 3;
    };
    const widthAt = (band: number, y: number) => xAt(band, y) - xAt(band + 1, y);

    it("holds band width constant across the top region", () => {
      // Constant thickness means gap'(0) = gap''(0) = 0, so width must barely
      // move over the top tenth of the page — not just at y = 0 exactly.
      for (let band = 0; band < N; band++) {
        for (const y of [0, 25, 50, 100]) {
          expect(widthAt(band, y)).toBeCloseTo(GAP, 0);
        }
      }
    });

    it("keeps every band's top width uniform, whatever it does lower down", () => {
      // Uniform to 2dp, not exactly: y = 0 is u = OV/(H+OV) = 0.0385, so the u^3
      // term is already worth ~0.002 units of the 11.667 (0.02%). Zero to second
      // order is the contract; zero outright would need OV = 0.
      const tops = Array.from({ length: N }, (_, band) => widthAt(band, 0));
      for (const width of tops) {
        expect(width).toBeCloseTo(tops[0], 2);
      }
    });

    // Check (1): about 1:9.5 innermost, 1:12.5 outermost — never 1:1, which is
    // what a genuinely parallel-all-the-way "striped curtain" would give.
    it("opens each band by its own ratio, top to bottom", () => {
      const ratio = (band: number) => widthAt(band, H) / widthAt(band, 0);
      expect(ratio(0)).toBeCloseTo(9.5, 0);
      expect(ratio(N - 1)).toBeCloseTo(12.5, 0);
      for (let band = 1; band < N; band++) {
        expect(ratio(band)).toBeGreaterThan(ratio(band - 1));
      }
    });

    // Check (2): narrow at the top, wide at the bottom — a fan that is wide at
    // the top and closes downward is vertically flipped.
    it("is narrow at the top and widest at the bottom edge", () => {
      const span = (y: number) => xAt(0, y) - xAt(N, y);
      expect(span(0)).toBeLessThan(span(H));
      expect(span(H)).toBeCloseTo(W / 2, 1);
    });
  });

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

describe("typography (TYPE.md)", () => {
  // Read the built bundle, not the source: what ships is what gets marked.
  const dir = resolve("dist/assets");
  const cssFile = readdirSync(dir).find((f) => f.endsWith(".css"));
  const css = cssFile ? readFileSync(resolve(dir, cssFile), "utf8") : "";

  it("sets the title in TYPE.md's face stack, Avant Garde first", () => {
    // Order matters: Avant Garde is licensed and not bundled, so the chain must
    // fall through to Poppins 700 without the layout shifting.
    const stack = css.match(/ITC Avant Garde Gothic Bold[^;}]*/)?.[0] ?? "";
    expect(stack).toContain("ITC Avant Garde Gothic Bold");
    expect(stack.indexOf("Century Gothic")).toBeGreaterThan(
      stack.indexOf("ITC Avant Garde Gothic Bold"),
    );
    expect(stack.indexOf("Poppins")).toBeGreaterThan(
      stack.indexOf("Century Gothic"),
    );
  });

  it("makes Space Grotesk the body default so nothing hits a browser font", () => {
    expect(css).toMatch(/body\{[^}]*Space Grotesk/);
  });

  it("requests all three faces in one stylesheet link", () => {
    const href =
      doc.querySelector<HTMLLinkElement>('link[href*="fonts.googleapis.com/css2"]')
        ?.getAttribute("href") ?? "";
    for (const family of ["Space+Grotesk", "Poppins", "IBM+Plex+Mono"]) {
      expect(href).toContain(family);
    }
  });

  // §3: every machine utterance is mono, the CTA included.
  it("sets the CTA in IBM Plex Mono with bracket grammar", () => {
    const cta = doc.querySelector(".enter-observatory");
    expect(cta?.textContent?.trim()).toBe("[ ENTER OBSERVATORY ]");
    expect(css).toMatch(/\.enter-observatory\{[^}]*IBM Plex Mono/);
  });
});

describe("observatory star field (STARFIELD.md §B)", () => {
  const svg = doc.querySelector(".obs-stars");

  it("ships 190 stars written into the markup, not generated on load", () => {
    expect(svg?.querySelectorAll("circle")).toHaveLength(190);
  });

  it("clips them to the two black triangles the fan does not cover", () => {
    // Same viewBox and preserveAspectRatio as the fan, or the clip drifts off
    // the stripes as the window changes width.
    expect(svg?.getAttribute("viewBox")).toBe("0 0 1600 1000");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("none");
    const clip = doc.getElementById("fanGroundClip");
    const paths = clip ? Array.from(clip.querySelectorAll("path")) : [];
    expect(paths.map((p) => p.getAttribute("d"))).toEqual([
      "M0 0 L800 1000 L0 1000 Z",
      "M1600 0 L800 1000 L1600 1000 Z",
    ]);
    expect(svg?.querySelector("g")?.getAttribute("clip-path")).toBe(
      "url(#fanGroundClip)",
    );
  });

  // The clip would hide a stray star anyway, but a star placed on a stripe is
  // wasted markup and the rule is absolute: no star may ever sit on colour.
  it("places every star in the fan's ground, never on a stripe", () => {
    const circles = svg ? Array.from(svg.querySelectorAll("circle")) : [];
    expect(circles).not.toHaveLength(0);
    for (const c of circles) {
      const cx = Number(c.getAttribute("cx"));
      const cy = Number(c.getAttribute("cy"));
      expect(inFanGround(cx, cy)).toBe(true);
    }
  });

  it("is the same sky every visit — the generator is seeded, not random", () => {
    expect(observatoryStars()).toEqual(observatoryStars());
    const shipped = Array.from(
      svg?.querySelectorAll("circle") ?? [],
      (c) => `${c.getAttribute("cx")},${c.getAttribute("cy")}`,
    );
    expect(shipped).toEqual(
      observatoryStars().map((s) => `${s.cx},${s.cy}`),
    );
  });
});
