// The one place section 2's state lives, so the panels and the field cannot
// disagree about it. LEFT-FIND.md §0 fixes the pipeline and its direction:
//
//   archive rows → methodFilter (OBSERVE) → pool → REQUIRE DATA (AND) →
//   text query → sort → results → limit
//
// FIND reads methodFilter and never writes it. That one-directional rule is why
// the store exposes a separate setter per owner rather than a general merge:
// the type system then says which panel may change what.

import { C, type Archive, type Bucket, type Projection, type Row } from "./data";

export type PanelMode = "observe" | "find";
export type MethodFilter = "all" | Bucket;
export type SortKey = "name" | "distance" | "year" | "radius";

/** LEFT-FIND.md §2's eight requirements, as the columns each one needs. */
export const REQUIREMENTS: { id: string; label: string; cols: number[] }[] = [
  { id: "orbit", label: "Orbit", cols: [C.orbper, C.orbsmax] },
  { id: "size", label: "Size", cols: [C.rade] },
  { id: "mass", label: "Mass", cols: [C.bmasse] },
  { id: "temperature", label: "Temperature", cols: [C.eqt] },
  { id: "distance", label: "Distance", cols: [C.dist] },
  { id: "sky", label: "Sky position", cols: [C.ra, C.dec] },
  { id: "eccentricity", label: "Eccentricity", cols: [C.ecc] },
  {
    id: "sysready",
    label: "System view ready",
    cols: [C.orbper, C.orbsmax, C.rade, C.teff, C.srad],
  },
];

export interface State {
  panelMode: PanelMode;
  /** OBSERVE owns this, and only OBSERVE writes it. */
  methodFilter: MethodFilter;
  query: string;
  requirements: Set<string>;
  sort: SortKey;
  limit: number;
  projection: Projection;
  /** RIGHT-TARGET.md §2's three states. A click locks (selected), a hover
   *  previews. LEFT-FIND.md §4: a row hover and a point hover write the SAME
   *  state, so the two can never fight. */
  selectedIdx: number | null;
  previewIdx: number | null;
}

export const state: State = {
  panelMode: "observe",
  methodFilter: "all",
  query: "",
  requirements: new Set(),
  sort: "name",
  limit: 80,
  projection: "orbit",
  selectedIdx: null,
  previewIdx: null,
};

/** The record the TARGET panel shows: the preview wins while it exists, because
 *  previewing is what you are doing right now. */
export const targetIdx = (): number | null =>
  state.previewIdx ?? state.selectedIdx;

type Listener = () => void;
const listeners = new Set<Listener>();
export const subscribe = (fn: Listener): void => void listeners.add(fn);
export const emit = (): void => listeners.forEach((fn) => fn());

/** LEFT-OBSERVE.md §4: a filter change never subsets the archive — it only
 *  moves the emphasis. So this answers "is this row in the pool", and the
 *  renderer dims everything else rather than dropping it. */
export function inPool(archive: Archive, row: Row): boolean {
  if (state.methodFilter === "all") return true;
  return archive.bucketOf[row[C.method] as number] === state.methodFilter;
}

const hasAll = (row: Row, cols: number[]): boolean =>
  cols.every((i) => typeof row[i] === "number");

/** LEFT-FIND.md §0's pipeline, in order. Memoised on the key it names, with
 *  methodFilter part of that key — so an OBSERVE change invalidates the list
 *  for free rather than needing FIND to be told about it. */
let cacheKey = "";
let cached: { results: number[]; pool: number } | null = null;

export function results(archive: Archive): { results: number[]; pool: number } {
  const key = [
    state.methodFilter,
    state.query.trim().toLowerCase(),
    [...state.requirements].sort().join(","),
    state.sort,
  ].join("|");
  if (key === cacheKey && cached) return cached;

  const needed = REQUIREMENTS.filter((r) => state.requirements.has(r.id));
  const q = state.query.trim().toLowerCase();

  let pool = 0;
  const idx: number[] = [];
  for (let i = 0; i < archive.rows.length; i++) {
    const row = archive.rows[i];
    if (!inPool(archive, row)) continue;
    pool++; // the denominator is OBSERVE's pool, not the archive (§0)
    if (!needed.every((r) => hasAll(row, r.cols))) continue;
    if (q) {
      const name = String(row[C.name]).toLowerCase();
      const host = String(row[C.host]).toLowerCase();
      if (!name.includes(q) && !host.includes(q)) continue;
    }
    idx.push(i);
  }

  // §2: missing values always sort LAST, never as zero — a null radius is not
  // the smallest planet.
  const num = (i: number, col: number): number => {
    const v = archive.rows[i][col];
    return typeof v === "number" ? v : Number.POSITIVE_INFINITY;
  };
  const byName = (a: number, b: number): number =>
    String(archive.rows[a][C.name]).localeCompare(String(archive.rows[b][C.name]));
  if (state.sort === "name") idx.sort(byName);
  else if (state.sort === "distance")
    idx.sort((a, b) => num(a, C.dist) - num(b, C.dist) || byName(a, b));
  else if (state.sort === "radius")
    idx.sort((a, b) => num(a, C.rade) - num(b, C.rade) || byName(a, b));
  else
    // RECENT: newest first, but unknown years still sort last, not first.
    idx.sort((a, b) => {
      const ya = archive.rows[a][C.year];
      const yb = archive.rows[b][C.year];
      if (typeof ya !== "number") return typeof yb === "number" ? 1 : byName(a, b);
      if (typeof yb !== "number") return -1;
      return yb - ya || byName(a, b);
    });

  cacheKey = key;
  cached = { results: idx, pool };
  return cached;
}

/** LOAD_DATA.md §6's coverage glyph: what a record can be DRAWN with, which is
 *  a different question from whether it is a good planet. */
export function coverage(row: Row): boolean[] {
  return [
    typeof row[C.orbper] === "number" && typeof row[C.orbsmax] === "number",
    typeof row[C.rade] === "number",
    typeof row[C.bmasse] === "number",
    typeof row[C.eqt] === "number",
  ];
}
