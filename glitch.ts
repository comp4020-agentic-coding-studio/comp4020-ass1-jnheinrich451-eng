// GLITCH.md — the four code blocks that tear in when the CTA is hovered.
//
// Every line of text below is a read of the real archive (assets/exoplanets.json,
// distilled from PSCompPars_2026.08.08_10.48.26.csv by scripts/gen-exoplanets.mts).
// §4: content is always live dataset text, and if the data has not arrived the
// blocks still render — with `----` for counts and `—` for values — rather than
// delaying the reveal.

const DATA_URL = new URL("./assets/exoplanets.json", import.meta.url).href;

interface Archive {
  source: string;
  cols: string[];
  csvCols: string[];
  methods: string[];
  rows: (string | number | null)[][];
  flags: number[];
}

// §2.2, verbatim: truncate hard at the column width, then pad. Left for text,
// right for numbers.
function pad(v: unknown, n: number, right = false): string {
  const s = v == null ? "—" : String(v).slice(0, n);
  return right ? s.padStart(n) : s.padEnd(n);
}

// One <div> per line, white-space:pre — so the padding above is what aligns the
// columns, not a table.
function lines(host: HTMLElement, rows: string[]): void {
  host.replaceChildren(
    ...rows.map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }),
  );
}

// Column indices are looked up by name rather than hard-coded, so a change to
// the generator's column list cannot silently shift what these blocks report.
function columnIndex(archive: Archive, name: string): number {
  return archive.cols.indexOf(name);
}

function renderHeader(host: HTMLElement, archive: Archive | null): void {
  if (!archive) {
    lines(host, [
      "NASA EXOPLANET ARCHIVE",
      "RECORDS.... ----",
      "COLUMNS.... ----",
      "",
      "AWAITING TRANSFER",
    ]);
    return;
  }
  // §2: the 20 column names in two padded 16-wide columns.
  const names = archive.csvCols;
  const half = Math.ceil(names.length / 2);
  const table = Array.from({ length: half }, (_, i) =>
    `${pad(names[i], 16)}${pad(names[i + half] ?? "", 16)}`.trimEnd(),
  );
  lines(host, [
    "NASA EXOPLANET ARCHIVE",
    `SOURCE..... ${archive.source}`,
    `RECORDS.... ${archive.rows.length}`,
    `COLUMNS.... ${archive.csvCols.length}`,
    "",
    ...table,
  ]);
}

function renderStatus(host: HTMLElement, archive: Archive | null): void {
  const head = ["STATUS.... TRANSMITTING", "CURSOR.... open", ""];
  if (!archive) {
    lines(host, [...head, ...Array.from({ length: 6 }, () => `${pad("—", 24)}----`)]);
    return;
  }
  // Top 6 discovery methods by count, counted over all 6,336 records rather
  // than sampled — the number beside each name is the archive's real total.
  const methodIndex = columnIndex(archive, "method");
  const counts = new Map<number, number>();
  for (const row of archive.rows) {
    const m = row[methodIndex];
    if (typeof m === "number") counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  lines(host, [
    ...head,
    ...top.map(
      ([m, n]) => `${pad(archive.methods[m], 24)}${pad(n, 5, true)}`,
    ),
  ]);
}

function renderQuery(host: HTMLElement, archive: Archive | null): void {
  const head = ["> SELECT pl_name, disc_year, sy_dist", ""];
  if (!archive) {
    lines(host, [
      ...head,
      ...Array.from(
        { length: 8 },
        () => `${pad("—", 20)}${pad("—", 6, true)}${pad("—", 10, true)}`,
      ),
    ]);
    return;
  }
  const name = columnIndex(archive, "name");
  const year = columnIndex(archive, "year");
  const dist = columnIndex(archive, "dist_pc");
  // The 8 nearest systems with a measured distance. A real ORDER BY, so the
  // block reports something true about the archive rather than its first 8 rows.
  const nearest = archive.rows
    .filter((r) => typeof r[dist] === "number")
    .sort((a, b) => (a[dist] as number) - (b[dist] as number))
    .slice(0, 8);
  lines(host, [
    ...head,
    ...nearest.map(
      (r) =>
        `${pad(r[name], 20)}${pad(r[year], 6, true)}${pad(
          typeof r[dist] === "number" ? (r[dist] as number).toFixed(2) : null,
          10,
          true,
        )}`,
    ),
  ]);
}

function renderFlags(host: HTMLElement, archive: Archive | null): void {
  const head = [`${pad("", 20)} tr rv im mi`, ""];
  if (!archive) {
    lines(host, [
      ...head,
      ...Array.from({ length: 8 }, () => `${pad("—", 20)}  —  —  —  —`),
    ]);
    return;
  }
  const name = columnIndex(archive, "name");
  // The 8 planets carrying the most detection flags — the rows where the matrix
  // has something to show. Ties break on the archive's own order.
  const bits = (f: number) => ((f >> 0) & 1) + ((f >> 1) & 1) + ((f >> 2) & 1) + ((f >> 3) & 1);
  const order = archive.rows
    .map((row, i) => ({ row, f: archive.flags[i] ?? 0 }))
    .sort((a, b) => bits(b.f) - bits(a.f))
    .slice(0, 8);
  lines(host, [
    ...head,
    ...order.map(
      ({ row, f }) =>
        pad(row[name], 20) +
        [0, 1, 2, 3].map((bit) => ((f >> bit) & 1 ? "  1" : "  0")).join(""),
    ),
  ]);
}

const RENDERERS = [renderHeader, renderStatus, renderQuery, renderFlags];

export function initGlitch(): void {
  const cta = document.querySelector<HTMLElement>(".enter-observatory");
  const blocks = ["c1", "c2", "c3", "c4"].map((id) =>
    document.getElementById(`glitch-${id}`),
  );
  if (!cta || blocks.some((b) => !(b instanceof HTMLElement))) return;
  const panels = blocks.filter((b): b is HTMLElement => b instanceof HTMLElement);

  const paint = (archive: Archive | null) => {
    panels.forEach((panel, i) => RENDERERS[i](panel, archive));
  };

  // Placeholders first, so the blocks are real elements with real height from
  // the start and the reveal never waits on the network (§4).
  paint(null);

  fetch(DATA_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((archive: Archive) => paint(archive))
    .catch(() => {
      /* placeholders stand — §4 prefers ---- over a delayed reveal */
    });

  // §1's three-value state. `null` means never touched, and it must render as
  // animation:none — without it all four blocks would play their EXIT on mount.
  // The class is only added on the first real pointer event, which is what
  // `touched` gates.
  const setHover = (hovering: boolean) => {
    document.body.classList.add("cta-touched");
    document.body.classList.toggle("cta-hover", hovering);
  };
  cta.addEventListener("pointerenter", () => setHover(true));
  cta.addEventListener("pointerleave", () => setHover(false));
  // Keyboard reaches the same state, or the blocks are mouse-only — the CTA is
  // focusable and this is its only feedback beyond the outline.
  cta.addEventListener("focus", () => setHover(true));
  cta.addEventListener("blur", () => setHover(false));
}
