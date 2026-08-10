// OPEN-SYSTEM.md — the archive becomes a system, and becomes an archive again.
//
// §0 is the principle and the hardest part to get right: the archive is NEVER
// mutated. It is saved, restored under cover, and found untouched on RETURN.
// So this module takes a snapshot, hands back a restore function, and touches
// nothing else — every field-side change happens behind the veil.
//
// §6's disclosure block "is not optional". Everything above it in the panel is
// a raw archive value; the block names every liberty the view takes. That is
// the whole contract of the system view: real numbers stated, every liberty
// named. It is built from a list here rather than written into the markup, so
// adding a compression without disclosing it takes a deliberate omission.

import * as THREE from "three";
import { C, type Archive, type Row, hash01 } from "./data";

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** §6's twelve ARCHIVE VALUES rows. Raw, unrounded beyond their stated
 *  precision, and UNRESOLVED when absent — this half of the panel makes no
 *  claims the archive does not. */
const VALUES: { label: string; col: number; dp: number; unit: string }[] = [
  { label: "Planet", col: C.name, dp: -1, unit: "" },
  { label: "Host", col: C.host, dp: -1, unit: "" },
  { label: "Method", col: C.method, dp: -1, unit: "" },
  { label: "Discovered", col: C.year, dp: 0, unit: "" },
  { label: "Semi-major", col: C.orbsmax, dp: 3, unit: "AU" },
  { label: "Period", col: C.orbper, dp: 2, unit: "D" },
  { label: "Eccentricity", col: C.ecc, dp: 3, unit: "" },
  { label: "Radius", col: C.rade, dp: 2, unit: "R⊕" },
  { label: "Mass", col: C.bmasse, dp: 2, unit: "M⊕" },
  { label: "Eq temp", col: C.eqt, dp: 0, unit: "K" },
  { label: "Star temp", col: C.teff, dp: 0, unit: "K" },
  { label: "Star radius", col: C.srad, dp: 3, unit: "R☉" },
];

/** §6: every compression, named by hand. Adding one to the scene without adding
 *  it here is the omission the block exists to prevent. */
const DISCLOSURES: [string, string][] = [
  ["Planet scale", "VISUALLY COMPRESSED"],
  ["Orbit scale", "VISUALLY COMPRESSED"],
  ["Time scale", "VISUALLY COMPRESSED"],
  ["Orbit speed", "KEPLERIAN"],
  ["Eccentricity", "FROM ARCHIVE"],
  ["Orbit shape", "COPLANAR · INCLINATION NOT SHOWN"],
  ["Star apparent size", "FROM ARCHIVE RADIUS"],
  ["Rotation", "ILLUSTRATIVE"],
  ["Surface", "PROCEDURAL · NOT OBSERVED"],
  ["Display phase", "SIMULATED"],
];

export interface FieldSnapshot {
  restore: () => void;
}

const reduceMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let open = false;
export const systemIsOpen = (): boolean => open;

/**
 * §1's dive and §2's entry. `snapshot` is taken by the caller BEFORE anything
 * moves and replayed at 720 ms behind the veil, so RETURN lands on exactly the
 * frame the user left (§1, §5).
 */
export function openSystem(
  archive: Archive,
  idx: number,
  snapshot: FieldSnapshot,
): void {
  if (open) return; // §1: skipped entirely if the system is already open
  open = true;
  const row = archive.rows[idx];

  // §1: the veil takes the archive to black ACROSS the dive, so the shell never
  // cross-fades against a live field — that double exposure was the blink.
  const veil = el("div", "dive-veil");
  document.body.append(veil);
  const instant = reduceMotion();
  if (!instant) {
    veil.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 600,
      easing: "cubic-bezier(.7,0,.9,.3)",
      fill: "forwards",
    });
  } else {
    veil.style.opacity = "1";
  }

  const mount = (): void => {
    // At 720ms: mount, THEN silently restore the field behind the veil.
    const shell = buildShell(archive, row, () => closeSystem(shell, veil));
    document.body.append(shell);
    snapshot.restore();
    requestAnimationFrame(() => shell.classList.add("is-in"));
  };
  if (instant) mount();
  else window.setTimeout(mount, 720);
}

function closeSystem(shell: HTMLElement, veil: HTMLElement): void {
  if (!open) return;
  open = false;
  // §5: the scene keeps animating throughout — freezing it first is what made
  // the exit read as a blink. So the shell fades while its own loop runs on,
  // and only then unmounts.
  const done = (): void => {
    shell.remove();
    veil.remove();
  };
  if (reduceMotion()) return done();
  shell.classList.remove("is-in");
  window.setTimeout(done, 560);
}

function buildShell(
  archive: Archive,
  row: Row,
  onReturn: () => void,
): HTMLElement {
  const shell = el("div", "system-shell");
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  shell.setAttribute("aria-label", `System view, ${String(row[C.name])}`);

  const canvas = el("canvas", "system-canvas");
  canvas.setAttribute("aria-hidden", "true");
  shell.append(canvas);

  // §6 top-left.
  const head = el("div", "system-head");
  head.append(
    el("p", "system-kicker", "System view"),
    el("h2", "system-name", String(row[C.name])),
    el(
      "p",
      "system-host",
      `Host ${String(row[C.host])} · ${archive.methods[row[C.method] as number]}`,
    ),
  );
  shell.append(head);

  // §6 top-right.
  const ret = el("button", "system-return", "[ Return to field ]");
  ret.type = "button";
  ret.addEventListener("click", onReturn);
  shell.append(ret);

  // §6 right panel: raw values, then the rule, then the disclosure.
  const panel = el("aside", "system-panel");
  panel.append(el("h3", undefined, "Archive values"));
  const dl = el("dl", "system-values");
  for (const v of VALUES) {
    const raw = row[v.col];
    let text: string;
    if (v.col === C.method) text = archive.methods[raw as number];
    else if (typeof raw === "number")
      text = `${v.dp >= 0 ? raw.toFixed(v.dp) : raw}${v.unit ? ` ${v.unit}` : ""}`;
    else if (typeof raw === "string") text = raw;
    else text = "UNRESOLVED";
    dl.append(el("dt", undefined, v.label), el("dd", undefined, text));
  }
  panel.append(dl);

  const disc = el("div", "system-disclosure");
  disc.append(
    el("p", "disc-head", "Data-driven visualisation"),
    el("p", "disc-head", "Not an observed image"),
  );
  const dl2 = el("dl");
  const scaleNote = el("dd", undefined, "VISUALLY COMPRESSED");
  for (const [k, v] of DISCLOSURES) {
    const dd = k === "Orbit scale" ? scaleNote : el("dd", undefined, v);
    dl2.append(el("dt", undefined, k), dd);
  }
  disc.append(dl2);
  panel.append(disc);
  shell.append(panel);

  // §6 bottom-left: zoom, orbit scale, and the gesture legend.
  const foot = el("div", "system-foot");
  const zoomOut = el("button", "sys-btn", "−");
  const zoomIn = el("button", "sys-btn", "+");
  zoomOut.type = "button";
  zoomIn.type = "button";
  foot.append(zoomOut, zoomIn, el("span", "dim", "Orbit scale"));
  const scaleBtns: HTMLButtonElement[] = [1, 3, 5].map((n) => {
    const b = el("button", "sys-btn", `×${n}`);
    b.type = "button";
    b.dataset.scale = String(n);
    foot.append(b);
    return b;
  });
  foot.append(
    el("span", "sys-legend", "Drag to inspect · Wheel to zoom · Esc to return"),
  );
  shell.append(foot);

  const scene = buildScene(canvas, row, zoomIn, zoomOut, scaleBtns, scaleNote);
  shell.addEventListener("keydown", (e) => {
    if (e.key === "Escape") onReturn(); // §5
  });
  ret.focus();

  // Stop the loop when the shell leaves the document, or it runs forever.
  new MutationObserver((_, o) => {
    if (!shell.isConnected) {
      scene.stop();
      o.disconnect();
    }
  }).observe(document.body, { childList: true });

  return shell;
}

/** §2's entry and §3's zoom. The scene is real: the ellipse comes from the
 *  archive's semi-major axis and eccentricity, the planet's size from its
 *  radius, the star's from the host radius. Everything it compresses is named
 *  in the disclosure block above. */
function buildScene(
  canvas: HTMLCanvasElement,
  row: Row,
  zoomIn: HTMLButtonElement,
  zoomOut: HTMLButtonElement,
  scaleBtns: HTMLButtonElement[],
  scaleNote: HTMLElement,
): { stop: () => void } {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 4000);

  const num = (i: number, fallback: number): number =>
    typeof row[i] === "number" ? (row[i] as number) : fallback;

  // Scene units are planet radii, so the planet is always a known size and the
  // clearances below can be reasoned about (§3).
  const planetR = 1;
  const rade = num(C.rade, 1);
  const srad = num(C.srad, 1); // R_sun
  // R_sun / R_earth = 109.1, so the star's true ratio to the planet is exact
  // from archive values — §4: "star apparent size ... computed from archive".
  const starR = Math.max(planetR * 1.6, (srad * 109.1) / Math.max(rade, 0.1));
  const aAU = num(C.orbsmax, 0.05);
  // 1 AU / R_earth = 23 455. Compressed, and disclosed as such.
  let orbitScale = 1;
  const baseOrbitR = Math.max(starR * 2.2, planetR * 22);
  const ecc = Math.min(0.9, Math.max(0, num(C.ecc, 0)));

  const star = new THREE.Mesh(
    new THREE.SphereGeometry(starR, 48, 48),
    new THREE.MeshBasicMaterial({ color: teffColour(num(C.teff, 5500)) }),
  );
  scene.add(star);
  scene.add(new THREE.PointLight(0xffffff, 2.4, 0, 0));

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(planetR, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x9fb4d8, roughness: 0.92 }),
  );
  scene.add(planet);

  const ring = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x96aaff,
      transparent: true,
      opacity: 0.34,
    }),
  );
  scene.add(ring);

  let orbitR = baseOrbitR;
  function layoutOrbit(): void {
    orbitR = baseOrbitR * orbitScale;
    const b = orbitR * Math.sqrt(1 - ecc * ecc);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) {
      const t = (i / 256) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * orbitR - orbitR * ecc, 0, Math.sin(t) * b));
    }
    ring.geometry.dispose();
    ring.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }
  layoutOrbit();

  // §2: yaw measured from the planet→star direction. π would be a dead-on
  // full-lit disc, so π ± 0.95 keeps most of the lit face PLUS a terminator and
  // throws the star off the disc — the default frame is never an accidental
  // eclipse poster. The side is deterministic per name, not random.
  const side = hash01(String(row[C.name]), 17) < 0.5 ? -1 : 1;
  let yaw = Math.PI + side * 0.95;
  let pitch = 0.24;
  const entryDist = planetR * 6;
  let dist = Math.max(orbitR * 1.35, entryDist * 4);

  // §3: one continuous range, two regimes. The floor is derived from the
  // guaranteed periapsis clearance, so the camera can never enter the planet
  // and never escape toward the star.
  const minDist = planetR * 1.9;
  const maxDist = () => Math.max(planetR * 16, orbitR * 2.6);

  let stopped = false;
  const start = performance.now();
  let last = start;
  let angle = 0;
  const periodDays = num(C.orbper, 365);

  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // §2: approach from outside the orbit and close in, so it reads as
    // travelling TO the system rather than cutting to it.
    const t = Math.min(1, (now - start) / 1150);
    const eased = 1 - (1 - t) ** 3;
    const target = entryDist + (Math.max(orbitR * 1.35, entryDist * 4) - entryDist) * (1 - eased);
    if (t < 1) dist = target;

    // §3: revolution is read from the planet moving, never from camera motion.
    angle += (dt * Math.PI * 2) / Math.max(periodDays / 40, 2);
    const b = orbitR * Math.sqrt(1 - ecc * ecc);
    planet.position.set(
      Math.cos(angle) * orbitR - orbitR * ecc,
      0,
      Math.sin(angle) * b,
    );
    planet.rotation.y += dt * 0.25; // ILLUSTRATIVE, and disclosed as such

    const d = Math.min(maxDist(), Math.max(minDist, dist));
    const eye = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).multiplyScalar(d);
    camera.position.copy(planet.position).add(eye);
    camera.lookAt(planet.position);

    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== w * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // §3: camera orbit is USER-DRIVEN ONLY. Nothing moves the viewing angle on
  // its own, so every unprompted motion on screen belongs to the planet.
  let dragging = false;
  let px = 0;
  let py = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    px = e.clientX;
    py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw -= (e.clientX - px) * 0.006;
    pitch = Math.min(1.35, Math.max(-1.35, pitch + (e.clientY - py) * 0.006));
    px = e.clientX;
    py = e.clientY;
  });
  const endDrag = (): void => void (dragging = false);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  // Non-passive, per §3, because the wheel is a control here.
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dist = Math.min(maxDist(), Math.max(minDist, dist * Math.exp(e.deltaY * 0.0012)));
    },
    { passive: false },
  );
  zoomIn.addEventListener("click", () => {
    dist = Math.max(minDist, dist * 0.8);
  });
  zoomOut.addEventListener("click", () => {
    dist = Math.min(maxDist(), dist * 1.25);
  });

  // §4: a pure change of display unit. The camera's inspection distance is
  // untouched — planetR never changes — so the close view is identical at every
  // setting and only the space around it changes.
  for (const b of scaleBtns) {
    b.addEventListener("click", () => {
      orbitScale = Number(b.dataset.scale);
      layoutOrbit();
      for (const o of scaleBtns) o.classList.toggle("is-active", o === b);
      scaleNote.textContent =
        orbitScale === 1 ? "VISUALLY COMPRESSED" : `VISUALLY COMPRESSED · ×${orbitScale}`;
    });
  }
  scaleBtns[0].classList.add("is-active");

  return {
    stop: () => {
      stopped = true;
      renderer.dispose();
    },
  };
}

/** Star colour from its archive effective temperature — one of the values §4
 *  insists stays real. */
export function teffColour(teff: number): number {
  if (teff >= 10000) return 0xaec6ff;
  if (teff >= 7500) return 0xdce6ff;
  if (teff >= 6000) return 0xfff4ea;
  if (teff >= 5200) return 0xffe9c4;
  if (teff >= 3700) return 0xffcf94;
  return 0xff9d6b;
}

/** §3's clamps, exported so the contract is testable without a WebGL context. */
export const zoomLimits = (
  planetR: number,
  orbitR: number,
): { min: number; max: number } => ({
  min: planetR * 1.9,
  max: Math.max(planetR * 16, orbitR * 2.6),
});
