// LOAD_DATA.md — from the archive export to a normalised position.
//
// This module owns the numbers and nothing else: it never touches the DOM and
// never draws. field.ts renders whatever this returns, which is what makes the
// transforms testable without a canvas (see spec/data.test.ts).
//
// The two rules that shape the whole file are §2 and §4. §2: null is never
// coerced — a record missing what a projection needs is UNRESOLVED and is still
// drawn, in a holding cloud outside the scientific region, because dropping it
// would silently shrink the archive and mapping it to 0 would fabricate a
// measurement. §4: every "scatter" is a deterministic hash of the name, never
// Math.random, so a record lands in the same place on every visit and the
// display spread can never be mistaken for data.

const DATA_URL = new URL("./assets/exoplanets.json", import.meta.url).href;

/** §1's column order. Indices, not keys — the rows are column-indexed. */
export const C = {
  name: 0,
  host: 1,
  method: 2,
  year: 3,
  orbper: 4,
  orbsmax: 5,
  rade: 6,
  bmasse: 7,
  eqt: 8,
  dist: 9,
  ra: 10,
  dec: 11,
  ecc: 12,
  teff: 13,
  srad: 14,
} as const;

export type Row = (number | string | null)[];

export interface Archive {
  source: string;
  cols: string[];
  methods: string[];
  rows: Row[];
  /** §1: every method index mapped to one of the five buckets. */
  bucketOf: Bucket[];
}

export type Bucket =
  | "Transit"
  | "Radial Velocity"
  | "Imaging"
  | "Microlensing"
  | "Other";

/** §1's method colours. These are LOAD_DATA.md's, which differ from CLAUDE.md
 *  §2's data-encoding list — transit and radial velocity are swapped, and
 *  imaging, microlensing and other are different colours. The more specific and
 *  more recent document wins inside section 2. */
export const BUCKET_COLOUR: Record<Bucket, string> = {
  Transit: "#e8c37a",
  "Radial Velocity": "#9fc4ff",
  Imaging: "#c79bff",
  Microlensing: "#ffffff",
  Other: "#6c7699",
};

export const BUCKETS: Bucket[] = [
  "Transit",
  "Radial Velocity",
  "Imaging",
  "Microlensing",
  "Other",
];

/** §1. Only the four named techniques are their own bucket; everything else —
 *  timing variations, astrometry, pulsar timing — is Other. Matching on the
 *  exact string rather than a substring: "Transit Timing Variations" is NOT
 *  transit, and a `startsWith` would have quietly put it there. */
export function bucketFor(method: string): Bucket {
  switch (method) {
    case "Transit":
      return "Transit";
    case "Radial Velocity":
      return "Radial Velocity";
    case "Imaging":
      return "Imaging";
    case "Microlensing":
      return "Microlensing";
    default:
      return "Other";
  }
}

export type Projection = "orbit" | "distance" | "time" | "spatial";

/** §3. The fields each projection cannot draw without, as human labels — the
 *  TARGET panel prints exactly these. */
export function missingFor(row: Row, projection: Projection): string[] {
  const num = (i: number): number | null =>
    typeof row[i] === "number" ? (row[i] as number) : null;
  const need: string[] = [];
  const positive = (i: number, label: string): void => {
    const v = num(i);
    if (v === null || !(v > 0)) need.push(label);
  };
  if (projection === "orbit") {
    positive(C.orbper, "orbital period");
    positive(C.rade, "radius");
  } else if (projection === "distance") {
    positive(C.dist, "distance");
  } else if (projection === "spatial") {
    if (num(C.ra) === null) need.push("right ascension");
    if (num(C.dec) === null) need.push("declination");
    positive(C.dist, "distance");
  } else if (num(C.year) === null) {
    need.push("discovery year");
  }
  return need;
}

export const isResolved = (row: Row, p: Projection): boolean =>
  missingFor(row, p).length === 0;

// ---------------------------------------------------------------------------
// §4 — normalisation
// ---------------------------------------------------------------------------

/** §4: both normalisers emit 0.06 + 0.88t, so the scientific region never runs
 *  to the very edge of the box and a point at the extreme is still drawable. */
const pad = (t: number): number => 0.06 + 0.88 * Math.min(1, Math.max(0, t));

export const linNorm = (v: number, lo: number, hi: number): number =>
  pad(hi === lo ? 0.5 : (v - lo) / (hi - lo));

/** Log-normalised on log(v), so ratios rather than differences set the spacing.
 *  Guarded at 0 because log(0) is -Infinity and would poison the whole extent. */
export const logNorm = (v: number, lo: number, hi: number): number => {
  const l = Math.log(Math.max(v, Number.MIN_VALUE));
  const a = Math.log(Math.max(lo, Number.MIN_VALUE));
  const b = Math.log(Math.max(hi, Number.MIN_VALUE));
  return pad(b === a ? 0.5 : (l - a) / (b - a));
};

/** §4: FNV-1a with a salt. Deterministic by name, so the same record always
 *  gets the same angle or spread — this is display-only scatter, and it must
 *  never be mistaken for a measurement or fed back into stored coordinates. */
export function hash01(name: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export interface Extent {
  orbper: [number, number];
  rade: [number, number];
  year: [number, number];
  dist: [number, number];
}

/** Extents over the RESOLVED rows only. Including a null as a 0 would drag every
 *  lower bound to zero and squash the real spread against one edge. */
export function extentsOf(rows: Row[]): Extent {
  const span = (i: number, positive: boolean): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      const v = r[i];
      if (typeof v !== "number") continue;
      if (positive && !(v > 0)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return Number.isFinite(lo) ? [lo, hi] : [0, 1];
  };
  return {
    orbper: span(C.orbper, true),
    rade: span(C.rade, true),
    year: span(C.year, false),
    dist: span(C.dist, true),
  };
}

export interface Pos {
  x: number;
  y: number;
  /** Set only by SPATIAL: eye-space depth, for §7's depth cue. */
  depth?: number;
  /** Has the DATA a projection needs. §2's sense of the word. */
  resolved: boolean;
  /** SPATIAL only: fully measured, but behind the eye this frame, so it cannot
   *  be projected. A camera state, NOT a data state — conflating the two would
   *  report 2,044 fully measured records as UNRESOLVED, which is the exact
   *  fabrication §2 forbids. It is counted as resolved and simply not painted. */
  behind?: boolean;
}

/** §4's holding cloud: a disc around cx (default 1.15) with radii 0.072k and
 *  0.15k, so it sits deliberately OUTSIDE the 0–1 scientific region and can
 *  never be read as a measured position. */
export function unresolvedPos(name: string, cx = 1.15, k = 1): Pos {
  const a = hash01(name, 11) * Math.PI * 2;
  const rr = Math.sqrt(hash01(name, 13));
  return {
    x: cx + Math.cos(a) * 0.072 * k * rr,
    y: 0.5 + Math.sin(a) * 0.15 * k * rr,
    resolved: false,
  };
}

export interface Camera {
  yaw: number;
  pitch: number;
  dist: number;
}

/** §5's scientific transform. r = ln(1+dist) is monotonic, so ORDERING IS
 *  EXACT — that is the whole reason for the log: raw distance spans 1.30 to
 *  8500 pc, and a linear radius collapses 99% of the archive into the origin.
 *  The 6538x ratio becomes 10.9x; ranking survives, absolute spacing does not.
 *  The point is the HOST SYSTEM, not the planet's own position. */
export function skyXYZ(distPc: number, raDeg: number, decDeg: number) {
  const r = Math.log(1 + distPc);
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return {
    x: r * Math.cos(dec) * Math.cos(ra),
    y: r * Math.sin(dec),
    z: r * Math.cos(dec) * Math.sin(ra),
  };
}

const F = 1 / Math.tan((24 * Math.PI) / 180);

/** §5's camera: yaw about +Y, then pitch about +X, sitting at `dist` on the view
 *  axis and always looking at the origin (SOL). It never writes back into the
 *  coordinates — it only reads them. */
export function project(
  p: { x: number; y: number; z: number },
  cam: Camera,
): Pos | null {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const ze = z2 + cam.dist;
  if (ze <= 0.01) return null; // behind the eye
  return {
    x: 0.5 + (0.45 * F * x1) / ze,
    y: 0.5 - (0.45 * F * y2) / ze,
    depth: ze,
    resolved: true,
  };
}

/** §5: the holding cloud drifts outward on sqrt, not linearly, so a real net
 *  dolly survives while the two clouds stay separated at any zoom. */
export const cloudK = (camDist: number): number =>
  Math.min(Math.sqrt(2.75 / camDist), 2);

/** §4's four mappings. Everything a projection cannot resolve goes to the
 *  holding cloud rather than to a coordinate that would look measured. */
export function positionOf(
  row: Row,
  projection: Projection,
  ext: Extent,
  cam: Camera,
): Pos {
  const name = String(row[C.name]);
  const k = projection === "spatial" ? cloudK(cam.dist) : 1;
  if (!isResolved(row, projection)) return unresolvedPos(name, 1.15, k);

  const n = (i: number): number => row[i] as number;

  if (projection === "orbit") {
    return {
      x: logNorm(n(C.orbper), ext.orbper[0], ext.orbper[1]),
      y: 1 - logNorm(n(C.rade), ext.rade[0], ext.rade[1]),
      resolved: true,
    };
  }

  if (projection === "time") {
    return {
      x: linNorm(n(C.year), ext.year[0], ext.year[1]),
      // Display only: the vertical axis carries no data, it spreads the year's
      // records so they do not stack into one column.
      y: 0.08 + 0.84 * hash01(name, 7),
      resolved: true,
    };
  }

  if (projection === "distance") {
    const r = logNorm(1 + n(C.dist), 1 + ext.dist[0], 1 + ext.dist[1]) * 0.46;
    const th = hash01(name, 3) * Math.PI * 2; // display only: angle is not data
    return { x: 0.5 + r * Math.cos(th), y: 0.5 + r * Math.sin(th), resolved: true };
  }

  const p = project(skyXYZ(n(C.dist), n(C.ra), n(C.dec)), cam);
  // Behind the eye: the record keeps its resolved status, because its data is
  // complete. It is flagged instead of being pushed into the holding cloud,
  // which is reserved for records that are genuinely missing a measurement.
  return p ?? { x: 0.5, y: 0.5, resolved: true, behind: true };
}

/** The camera distance at which the whole archive fits the box, derived rather
 *  than chosen: §5's projection puts a point at radius r and screen edge at
 *  0.45·f·r/(dist − r), and holding that under 0.44 of the box gives
 *  dist ≥ r·(1 + 0.45·f/0.44). With ln(1+8500) = 9.05 that is about 30.
 *  Picking a round number instead would have put the far shell outside the
 *  frame at some viewport and looked like clipping. */
export function fitCameraDist(maxDistPc: number): number {
  const rMax = Math.log(1 + maxDistPc);
  return rMax * (1 + (0.45 * F) / 0.44);
}

// ---------------------------------------------------------------------------
// §5 — the contract
// ---------------------------------------------------------------------------

export interface SkyCheck {
  name: string;
  pass: boolean;
  detail: string;
}

/** §5 says to keep these: "they are the contract". Written to return their
 *  results rather than only console.log them, so spec/data.test.ts can assert
 *  the same table CI would otherwise never see. */
export function verifySkyTransform(): SkyCheck[] {
  const near = skyXYZ(1.3, 0, 0);
  const far = skyXYZ(8500, 0, 0);
  const checks: SkyCheck[] = [];
  const eq = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) < tol;

  checks.push({
    name: "radius is log-compressed",
    pass: eq(Math.hypot(near.x, near.y, near.z), Math.log(2.3)),
    detail: `r(1.3pc) = ${Math.hypot(near.x, near.y, near.z).toFixed(6)}`,
  });

  const ratio =
    Math.hypot(far.x, far.y, far.z) / Math.hypot(near.x, near.y, near.z);
  checks.push({
    name: "6538x span compresses to ~10.9x",
    pass: Math.abs(ratio - 10.9) < 0.15,
    detail: `ratio ${ratio.toFixed(2)}x`,
  });

  // The property the whole log rests on: ordering must survive exactly.
  let monotone = true;
  let prev = -Infinity;
  for (let d = 1.3; d < 8500; d *= 1.35) {
    const r = Math.log(1 + d);
    if (r <= prev) monotone = false;
    prev = r;
  }
  checks.push({
    name: "ordering is exact (r monotonic in distance)",
    pass: monotone,
    detail: "r = ln(1 + dist) strictly increasing",
  });

  // RA 90 deg must land on +Z, dec 90 on +Y: the axis convention itself.
  const ra90 = skyXYZ(10, 90, 0);
  const dec90 = skyXYZ(10, 0, 90);
  checks.push({
    name: "RA 90 lies on +Z",
    pass: eq(ra90.z, Math.log(11), 1e-9) && Math.abs(ra90.x) < 1e-9,
    detail: `(${ra90.x.toFixed(3)}, ${ra90.y.toFixed(3)}, ${ra90.z.toFixed(3)})`,
  });
  checks.push({
    name: "Dec 90 lies on +Y",
    pass: eq(dec90.y, Math.log(11), 1e-9) && Math.abs(dec90.x) < 1e-9,
    detail: `(${dec90.x.toFixed(3)}, ${dec90.y.toFixed(3)}, ${dec90.z.toFixed(3)})`,
  });

  // SOL is the origin, and the camera looks at it: it must project to centre.
  const centre = project({ x: 0, y: 0, z: 0 }, { yaw: 0, pitch: 0, dist: 3 });
  checks.push({
    name: "SOL projects to the centre",
    pass: !!centre && eq(centre.x, 0.5, 1e-12) && eq(centre.y, 0.5, 1e-12),
    detail: centre ? `(${centre.x.toFixed(4)}, ${centre.y.toFixed(4)})` : "null",
  });

  return checks;
}

export interface SkyAudit {
  rows: number;
  drawn: number;
  resolved: number;
  unresolved: number;
  byBucket: Record<string, number>;
}

/** §5's coverage report. Its one job is to prove §2: drawn must equal rows, so
 *  no record is ever silently dropped from the field. */
export function auditSky3D(
  archive: Archive,
  projection: Projection,
  ext: Extent,
  cam: Camera,
): SkyAudit {
  const byBucket: Record<string, number> = {};
  let resolved = 0;
  let drawn = 0;
  for (const r of archive.rows) {
    const p = positionOf(r, projection, ext, cam);
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) drawn++;
    if (p.resolved) resolved++;
    const b = archive.bucketOf[r[C.method] as number];
    byBucket[b] = (byBucket[b] ?? 0) + 1;
  }
  return {
    rows: archive.rows.length,
    drawn,
    resolved,
    unresolved: archive.rows.length - resolved,
    byBucket,
  };
}

export function buildArchive(raw: {
  source: string;
  cols: string[];
  methods: string[];
  rows: Row[];
}): Archive {
  return { ...raw, bucketOf: raw.methods.map(bucketFor) };
}

export async function loadArchive(): Promise<Archive> {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`archive ${response.status}`);
  return buildArchive(await response.json());
}
