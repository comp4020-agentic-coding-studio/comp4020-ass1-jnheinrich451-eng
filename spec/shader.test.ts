import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The GLSL shaders live in template literals in hero.ts, so a backtick typed
// inside one of their comments ends the string mid-shader. It has happened
// twice: once writing "the exponent on `lit`", once "the `visible` gate". Both
// times the reported errors pointed ten to thirty lines below the real cause,
// at whatever line first failed to parse as TypeScript, which is a slow thing
// to read backwards from.
//
// Neither the compiler nor stylelint can name this — tsc reports the symptom.
// This test names the cause, so the next occurrence costs one line instead of
// a bisect. It reads the source rather than the build because by build time the
// file no longer parses at all.
const SRC = readFileSync(resolve("hero.ts"), "utf8").split("\n");

function shaderRegions(): { name: string; start: number; lines: string[] }[] {
  const regions: { name: string; start: number; lines: string[] }[] = [];
  let current: { name: string; start: number; lines: string[] } | null = null;
  SRC.forEach((line, i) => {
    const open = /(vertexShader|fragmentShader):\s*`/.exec(line);
    if (open && !current) {
      current = { name: open[1], start: i + 1, lines: [] };
      return;
    }
    if (current) {
      // The literal is closed by its own `, on a line of its own.
      if (/^\s*`\s*,?\s*$/.test(line)) {
        regions.push(current);
        current = null;
        return;
      }
      current.lines.push(line);
    }
  });
  return regions;
}

describe("shader source (hero.ts)", () => {
  const regions = shaderRegions();

  // Two materials carry shaders — the starfield and the limb glow — so four
  // literals, not two. Asserted rather than assumed: if a material is added or
  // removed the count changes here, which is the signal that the scan below is
  // no longer covering everything it should.
  it("finds a vertex and a fragment literal for each shader material", () => {
    expect(regions).toHaveLength(4);
    expect(regions.filter((r) => r.name === "vertexShader")).toHaveLength(2);
    expect(regions.filter((r) => r.name === "fragmentShader")).toHaveLength(2);
  });

  it("contains no backtick inside a shader literal", () => {
    const offenders = regions.flatMap((r) =>
      r.lines
        .map((line, i) => ({ line, at: r.start + i + 1 }))
        .filter((l) => l.line.includes("`"))
        .map((l) => `hero.ts:${l.at} (${r.name}): ${l.line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  // A uniform added to the JS `uniforms` object but never declared in the GLSL
  // compiles to nothing: three.js logs "undeclared identifier" and carries on
  // with a dead material, so the page keeps rendering minus one layer. That is
  // exactly what happened to uSeam — the limb glow silently stopped drawing and
  // only a console line said so.
  //
  // Every uName referenced in a shader must be declared in that same shader.
  it("declares every uniform it references", () => {
    for (const r of regions) {
      const body = r.lines.join("\n");
      const declared = new Set(
        [...body.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map((m) => m[1]),
      );
      const referenced = new Set(
        [...body.matchAll(/\bu[A-Z]\w*/g)].map((m) => m[0]),
      );
      const undeclared = [...referenced].filter((n) => !declared.has(n));
      expect(undeclared, `${r.name} references undeclared ${undeclared.join(", ")}`)
        .toEqual([]);
    }
  });

  // The seam is the contract the hot spot and the rim shader now share. If the
  // shader ever goes back to deriving its own direction, the two cores separate
  // by a quarter turn again and nothing else here would catch it.
  it("takes the seam as a uniform rather than deriving its own hot direction", () => {
    // The limb glow's fragment shader, identified by a uniform only it has —
    // not by position, which would silently pick the starfield's if the two
    // materials were ever reordered.
    const frag = regions.find(
      (r) => r.name === "fragmentShader" && r.lines.join("\n").includes("uRimWrap"),
    );
    expect(frag, "no fragment shader declaring uRimWrap").toBeDefined();
    const body = frag?.lines.join("\n") ?? "";
    expect(body).toContain("uSeam");
    expect(body).not.toMatch(/uLightDir\s*-\s*uViewAxis\s*\*\s*dot\(/);
  });
});
