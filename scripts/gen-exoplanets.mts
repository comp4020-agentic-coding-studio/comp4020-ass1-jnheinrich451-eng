// Rebuilds assets/exoplanets.json from the NASA Exoplanet Archive CSV.
//
// The JSON already existed with no generator beside it, which made it a fact
// nobody could re-derive. This script exists so the file is reproducible, and it
// REFUSES to write unless every one of the 15 existing columns comes out
// byte-identical to what is already there — the two additions below are meant to
// be purely additive, and a diff in the shared columns means the parse is wrong,
// not that the data changed.
//
// The two additions:
//   csvCols — the CSV's first 20 column names, for GLITCH.md c1.
//   flags   — the four detection flags packed into one int per row. These are
//             NOT derivable from `method`: `method` is the discovery method
//             alone, while a planet can carry several flags once other
//             techniques have confirmed it. Deriving them would be inventing
//             them.
//
// Usage: node --experimental-strip-types scripts/gen-exoplanets.mts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CSV = "assets/PSCompPars_2026.08.08_10.48.26.csv";
const OUT = "assets/exoplanets.json";

// The 15 distilled columns, and the CSV field each is read from.
const COLUMNS: [string, string][] = [
  ["name", "pl_name"],
  ["host", "hostname"],
  ["method", "discoverymethod"],
  ["year", "disc_year"],
  ["orbper_days", "pl_orbper"],
  ["orbsmax_au", "pl_orbsmax"],
  ["rade_earth", "pl_rade"],
  ["bmasse_earth", "pl_bmasse"],
  ["eqt_k", "pl_eqt"],
  ["dist_pc", "sy_dist"],
  ["ra_deg", "ra"],
  ["dec_deg", "dec"],
  ["ecc", "pl_orbeccen"],
  ["teff_k", "st_teff"],
  ["srad_sun", "st_rad"],
];

// Bit order matches GLITCH.md c4's "tr rv im mi" reading order.
const FLAG_FIELDS = ["tran_flag", "rv_flag", "ima_flag", "micro_flag"];

// Minimal RFC4180: quoted fields, doubled quotes inside them. The archive's
// facility names carry commas, so splitting on "," alone silently shifts every
// column after disc_facility.
function splitRow(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

const text = readFileSync(resolve(CSV), "utf8");
const lines = text
  .split(/\r?\n/)
  .filter((l) => l.length > 0 && !l.startsWith("#"));
const header = splitRow(lines[0]);
const index = (field: string) => {
  const i = header.indexOf(field);
  if (i < 0) throw new Error(`CSV has no column ${field}`);
  return i;
};

// Blank means "the archive has no value", which must stay null rather than
// becoming 0 — a missing eccentricity is not a circular orbit.
const value = (raw: string): string | number | null => {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
};

const methods: string[] = [];
const rows: (string | number | null)[][] = [];
const flags: number[] = [];

for (const line of lines.slice(1)) {
  const cells = splitRow(line);
  const row = COLUMNS.map(([name, field]) => {
    const raw = cells[index(field)];
    if (name !== "method") return value(raw);
    // Methods are interned in first-seen order, which is what the existing file
    // did — the index is a pointer into `methods`, not a stable archive code.
    let at = methods.indexOf(raw);
    if (at < 0) at = methods.push(raw) - 1;
    return at;
  });
  rows.push(row);
  flags.push(
    FLAG_FIELDS.reduce(
      (bits, field, bit) =>
        cells[index(field)] === "1" ? bits | (1 << bit) : bits,
      0,
    ),
  );
}

// Refuse to write on any difference in the shared columns.
const previous = JSON.parse(readFileSync(resolve(OUT), "utf8"));
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
for (const key of ["cols", "methods", "rows"] as const) {
  const mine = key === "cols" ? COLUMNS.map(([name]) => name) : { methods, rows }[key];
  if (!same(previous[key], mine)) {
    throw new Error(
      `${key} differs from the existing ${OUT}. This generator is meant to be ` +
        `purely additive, so a difference here means the parse is wrong.`,
    );
  }
}

writeFileSync(
  resolve(OUT),
  JSON.stringify({
    source: CSV.split("/").pop(),
    cols: COLUMNS.map(([name]) => name),
    csvCols: header.slice(0, 20),
    methods,
    rows,
    flags,
  }),
);
console.log(
  `${OUT}: ${rows.length} rows, ${methods.length} methods, ` +
    `${header.length} CSV columns (first 20 kept)`,
);
