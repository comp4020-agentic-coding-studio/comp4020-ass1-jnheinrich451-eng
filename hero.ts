import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createHotspot } from "./hotspot";
import { placeScoutRoutes } from "./scouts";

// new URL(..., import.meta.url) lets Vite fingerprint the model and rewrite
// the path relative to the deployed base — a hard-coded "/assets/..." 404s
// once the site is served from a GitHub Pages subpath.
const MARS_MODEL_URL = new URL(
  "./assets/24881_Mars_1_6792.glb",
  import.meta.url,
).href;

// Radians of rotation per animation frame (~60fps): a full turn every ~3 minutes.
const MARS_ROTATION_SPEED = 0.0006;
const MARS_RADIUS = 2.6;
const STAR_COUNT = 2600;

// Must match #hero-title's letter-spacing in styles.css — measured width
// includes a trailing letter-space that isn't ink, and discounting it is what
// makes the outermost letters land on the limb rather than just inside it.
const TITLE_LETTER_SPACING_EM = 0.08;

// How far outside the silhouette the light point sits, in CSS px. The source is
// occluded by the planet and only tangent to it, so it is never exactly on the
// limb, as a FRACTION of the globe's radius rather than in CSS px.
//
// It was a px constant for five turns and ended at 21px, which is 5% of the
// radius at 1920x1080 and 12% of it at 390x844 — so the same nudge that looked
// right on the desktop threw the flare well off the limb on the phone. Any
// offset from a measured feature has to be measured in the same units as that
// feature.
//
// 0 now: the flare sits exactly on the sheen, which is where buildLimbGlow()'s
// shader draws the hot core, so the DOM composite and the shader highlight are
// the same point by construction rather than by tuning.
const FLARE_OUTSET_R = 0;

// §3.7's azimuth, in degrees, positive counter-clockwise on screen. It rolls
// the WHOLE light about the view axis — the DirectionalLight that shades the
// globe, the rim shader, the phase and the hotspot all read the one rolled
// direction.
//
// It used to roll the shadow only, leaving the rim and the flare on the
// unrolled star "so the highlight never detaches from the source". That put two
// light directions in a scene that physically has one, and at 90 they sat a
// quarter turn apart: the terminator said the light came from one side while
// the rim and hotspot said the other. Lit and shadowed must be complementary —
// HOTSPOT.md's own words, "a fixed and true rule" — and they cannot be if two
// vectors disagree about where the sun is.
//
// Rotating about the VIEW axis specifically is what keeps this free: phase is
// (1 + axis·dir)/2 and a rotation about an axis preserves every vector's
// component along that axis, so rolling the light cannot change how WIDE the
// shadow is, only where it lies. That is §3.7's claimed separation, and about
// this axis it is an identity rather than an arrangement. 0 is the physically
// correct case; anything else is the cinematic one.
const AZIMUTH_DEG = 90;

// How much longer the word runs than the limb rule alone would make it: 7/6, so
// 1/6 longer. Applied as scaleX in styles.css and targeted here, and the two must
// stay equal — matching them is what keeps the font SIZE unchanged while the word
// grows, so the title gets longer without getting taller.
//
// Consequence, stated rather than hidden: the B and S centres now sit at
// +/-(7/6)*marsPx, so Mars's limb no longer passes through their midpoints — it
// crosses 1/6 of a radius inside them. Set this to 1 to restore that rule.
const TITLE_LENGTH_GAIN = 7 / 6;

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

// STARFIELD.md §A — the hero's live 3D point field. Every constant here is the
// spec's; the previous version invented its own per-star rate/flicker/mag scheme,
// which §A.3 supersedes with one shared 0.55 rad/s rate and a per-star twinkle
// *depth* ("Stars are the calmest thing on the page. Never raise the frequency").
function buildStarfield(): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);
  const depths = new Float32Array(STAR_COUNT);
  const tints = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // acos(2u − 1) is the inverse transform for a uniform sphere. A naive
    // uniform phi puts visible density bands at the poles of every camera angle.
    const r = 30 + Math.random() * 45;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Three-tier size split standing in for a magnitude distribution: a handful
    // of anchors, a thin second rank, a dense faint floor. §A.2 is explicit that
    // changing these ratios makes the sky read as generated.
    const tier = Math.random();
    if (tier < 0.015) sizes[i] = 4.2 + Math.random() * 2.6;
    else if (tier < 0.1) sizes[i] = 2.2 + Math.random() * 1.2;
    else sizes[i] = 0.8 + Math.random() * 1.1;

    phases[i] = Math.random() * Math.PI * 2;
    depths[i] = 0.25 + Math.random() * 0.75;

    const hue = Math.random();
    const tint =
      hue < 0.18 ? [1, 0.86, 0.72] : hue < 0.38 ? [0.78, 0.86, 1] : [1, 1, 1];
    tints[i * 3] = tint[0];
    tints[i * 3 + 1] = tint[1];
    tints[i * 3 + 2] = tint[2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aTw", new THREE.BufferAttribute(depths, 1));
  geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute float aTw;
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vTint = aTint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float t = sin(uTime * 0.55 + aPhase) * 0.5 + 0.5;
        float pulse = mix(1.0 - aTw * 0.8, 1.0, t);
        vAlpha = clamp(0.28 + pulse * 0.72, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
        // Alpha and size twinkle together (+35%), which is what reads as
        // atmospheric scintillation rather than an opacity loop. 60/-mv.z is
        // the perspective falloff.
        gl_PointSize = aSize * uPixelRatio * (1.0 + pulse * 0.35) * (60.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float core = smoothstep(0.5, 0.0, r);
        float glow = pow(core, 3.0) + core * 0.28;
        gl_FragColor = vec4(vTint * glow, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { points: new THREE.Points(geometry, material), material };
}

// Reflective shell at exactly 1R — the same radius as the model, per the
// Starfield reference (assets/20260806222212_1.jpg): where the surface faces the
// sun, its limb burns cool blue-white; where it faces away, the limb goes dark
// and the terminator stays a hard edge.
//
// FrontSide with depthTest off, not the usual oversized BackSide shell. At 1R a
// BackSide shell has dot(N,V) < 0 everywhere, so the fresnel term saturates and
// floods the whole disc; and a same-radius shell that *is* depth-tested
// z-fights with the model it's wrapping. Drawing the near hemisphere additively
// with depth off avoids both, and puts the highlight exactly on the silhouette.
function buildLimbGlow(radius: number): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
} {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uViewAxis: { value: new THREE.Vector3(0, 0, 1) },
      // The day/night seam on the limb, handed in from the CPU rather than
      // recomputed here. The DOM overlay is placed from the same vector, and
      // sharing it is what stops the shader's core and the overlay's core
      // drifting into two highlights — which is exactly what they did when this
      // shader derived its own direction.
      uSeam: { value: new THREE.Vector3(0, 1, 0) },
      uLimb: { value: new THREE.Color(0xdce9ff) }, // cool blue-white
      uHot: { value: new THREE.Color(0xffffff) },
      // §3.7's RM = 0.35 + 1.75p: how far the rim glow wraps around the limb.
      uRimWrap: { value: 1 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uLightDir;
      uniform vec3 uViewAxis;
      uniform vec3 uSeam;
      uniform vec3 uLimb;
      uniform vec3 uHot;
      uniform float uRimWrap;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        // High exponent keeps the band tight against the silhouette instead of
        // washing the whole disc — the reference's highlight is a hard edge.
        float edge = pow(1.0 - max(dot(vNormalW, vViewW), 0.0), 12.0);
        float lit = max(dot(vNormalW, uLightDir), 0.0);

        // The star sits ON the day/night seam, N = ±(L×V)/|L×V|, one of the two
        // points where the terminator meets the silhouette. It used to sit at
        // L − V(V·L), the light projected onto the screen plane — the chord
        // midpoint's normal, which is the BRIGHTEST point of the lit limb and a
        // quarter turn from the seam.
        float aim = max(dot(vNormalW, uSeam), 0.0);

        // White-hot core, then a wider bloom around it: "only a small portion of
        // the source is visible", so the core is far tighter than the bloom.
        float core = pow(aim, 96.0);
        float bloom = pow(aim, 10.0);

        // No constant term: a base like 0.05 painted the whole limb including
        // the night side, which is exactly the grey halo the pure-dark shadow
        // must not have. Everything here is gated on the surface being lit, so
        // the dark limb falls to black with nothing on it.
        // §3.7's rim wrap. The extent the glow travels around the limb is set by
        // the exponent on lit, so RM divides it: a high exponent holds the
        // glow to a spark beside the star, a low one carries it around the
        // shoulder. §3.7's rim EXCEPTION is why only this term is touched — the
        // hard core keeps alpha 1.0 at every phase, because the limb right
        // beside the star is fully lit however thin the crescent is. Fading it
        // too made low phases read as fog rather than as a razor edge.
        float visible = smoothstep(0.0, 0.04, lit);
        float wrapped = pow(lit, 1.5 / max(uRimWrap, 0.05));

        // The seam has dot(N, L) = 0 by definition — that IS the terminator — so
        // the core and its bloom cannot carry the "visible" gate that the rim
        // wrap does. Gating them on lit would extinguish the star at precisely
        // the point it is now placed. They are held instead by "edge" and by
        // their own lobe about uSeam, which is tight enough not to leak around
        // the night limb: pow(aim, 10.0) is already halved about 21 degrees out,
        // and the rim wrap — the term that would wash the dark side — keeps its
        // gate. No backticks in here: this is inside a template literal, and one
        // ended the shader mid-string once already.
        float i = edge * (1.5 * visible * wrapped + 4.0 * core + 1.1 * bloom);
        vec3 tint = mix(uLimb, uHot, clamp(lit * 1.2 + core * 2.0, 0.0, 1.0));
        gl_FragColor = vec4(tint, clamp(i, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: false,
  });
  // Dense enough that the silhouette reads as a smooth circle, since the
  // highlight sits right on it and would show any faceting.
  return { mesh: new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 128), material), material };
}

function buildFallbackMars(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(MARS_RADIUS, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0xb5502f, roughness: 0.95 }),
  );
}

export function initHero(): void {
  const heroSection = document.getElementById("hero");
  const canvas = document.getElementById("hero-canvas");
  if (!(heroSection instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // alpha + a fully transparent clear colour: the fan SVG is painted *under*
  // this canvas (STRIPE.md §A.6), so an opaque canvas would hide it entirely.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 0.92 was a correction for a warm cast that turned out to be the monitor,
  // not the render, so it is back up — 1.15 to lift Mars overall.
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  // NO ambient light. Any fill lifts the night side off black, and the shadow is
  // meant to be pure dark — the terminator reads as a hard edge into nothing,
  // which is the whole aesthetic. The sun is the only light in the scene.
  const sun = new THREE.DirectionalLight(0xdce7ff, 3.7);
  scene.add(sun);

  // A full orbit, not the narrow arc it swept before. The arc existed to stop the
  // planet ever being caught fully dark, but a complete phase cycle is what was
  // asked for: Mars now runs lit -> crescent -> pure dark -> crescent, which is
  // also the only way to check the hotspot against a fully dark disc. The
  // trade-off is real and deliberate — for part of every cycle the planet is a
  // black disc with only its light point showing.
  const SUN_DISTANCE = 6;
  // 6.722e-5: 3% off the 6.93e-5 it ran at, so the terminator crosses the face
  // that much slower. Period is 2*pi/rate, about 93.5 s.
  const SUN_RATE = 0.00006722;

  // THE light direction — one vector, read by the DirectionalLight, the rim
  // shader, the phase and the hotspot alike. The orbit is computed first and the
  // azimuth roll is folded in here, so there is no second, unrolled direction
  // left anywhere for anything to disagree with.
  const lightDir = new THREE.Vector3();
  function placeSun(time: number): void {
    const angle = time * SUN_RATE;
    lightDir
      .set(Math.sin(angle) * SUN_DISTANCE, 2, Math.cos(angle) * SUN_DISTANCE)
      .normalize()
      .applyAxisAngle(
        camera.position.clone().normalize(),
        -(AZIMUTH_DEG * Math.PI) / 180,
      );
    sun.position.copy(lightDir).multiplyScalar(SUN_DISTANCE);
  }
  placeSun(0);

  const marsGroup = new THREE.Group();
  scene.add(marsGroup);
  let marsMesh: THREE.Object3D | null = null;
  // The GLB is scaled so its LONGEST axis spans MARS_RADIUS*2, so if the model is
  // not perfectly spherical its actual radius is slightly under MARS_RADIUS.
  // Measured after load, because projecting the flare and sizing the title from
  // the nominal radius put both a hair outside the real silhouette — visible as
  // a doubled hotspot, the CSS core beside the shader's.
  let marsWorldRadius = MARS_RADIUS;

  const limbGlow = buildLimbGlow(MARS_RADIUS);
  const title = document.getElementById("hero-title");
  // Host of the superseded CSS flare, kept alongside its commented-out code:
  // const flare = heroSection.querySelector<HTMLElement>(".limb-flare");
  const hotspotCanvas = heroSection.querySelector<HTMLCanvasElement>(
    "#hero-hotspot",
  );
  const hotspot =
    hotspotCanvas instanceof HTMLCanvasElement
      ? createHotspot(hotspotCanvas)
      : null;


  // The day/night SEAM on the limb, in closed form. The terminator is the set of
  // surface normals with N·L = 0; the silhouette is the set with N·V = 0; so the
  // two meet where N is perpendicular to both, N = ±(L×V)/|L×V|. Exactly two
  // points, and that ± is HOTSPOT.md's "which way (left or right) to go".
  //
  // This is NOT what the hotspot used before. nHot() returned L − V(V·L) — L
  // projected onto the screen plane, which is the limb point facing the light
  // most directly, i.e. the BRIGHTEST point of the lit limb and a quarter turn
  // from the seam. That was the right answer to REFLECTIVE-COVER.md's brief (the
  // terminator's chord midpoint, normal to the chord) and the wrong one for
  // HOTSPOT.md's, which wants the star breaking through where day meets night.
  // The request names its own diagnosis: a chord midpoint has ONE solution and
  // no side to choose, so being asked for left-or-right means ±(L×V).
  const seamDir = new THREE.Vector3();
  function nSeam(
    light: THREE.Vector3,
    axis: THREE.Vector3,
    side: number,
  ): THREE.Vector3 {
    seamDir.crossVectors(light, axis);
    // L is never parallel to V on this orbit (phase never reaches 0 or 1), but
    // guard anyway — a degenerate cross normalises to garbage rather than
    // failing, which is the kind of thing that shows up as one bad frame.
    if (seamDir.lengthSq() < 1e-12) return seamDir.set(1, 0, 0);
    return seamDir.normalize().multiplyScalar(side);
  }

  // Which of the two seam points the star breaks through, re-drawn once per
  // sunrise. Rolled on the way INTO the dark, not out of it: the switch then
  // happens while the hotspot is at its faintest, so the side is already decided
  // by the time there is anything to see.
  //
  // The threshold is derived, not picked. The light is (sin·D, 2, cos·D)
  // normalised and the camera looks down +Z, so axis·dir = cos(angle)·D/hypot(D,2)
  // and phase swings symmetrically about 0.5 by half that. Pure dark is therefore
  // phase ≈ 0.026 and never 0 — a plain `phase < 0.02` trigger would have looked
  // reasonable and never once fired.
  const PHASE_SWING = SUN_DISTANCE / Math.hypot(SUN_DISTANCE, 2);
  const PHASE_MIN = (1 - PHASE_SWING) / 2;
  const SUNRISE_P = PHASE_MIN + 0.02 * PHASE_SWING;
  const pickSide = (): number => (Math.random() < 0.5 ? -1 : 1);
  let seamSide = pickSide();
  let prevPhase = 1;
  function rollSeamSide(phase: number): void {
    if (prevPhase >= SUNRISE_P && phase < SUNRISE_P) seamSide = pickSide();
    prevPhase = phase;
  }

  // The bloom, halo and rays that spill OUTSIDE the silhouette are a DOM layer,
  // not a second three.js shell. A larger additive sphere raises the alpha of a
  // transparent canvas wherever it draws, and the canvas is transparent so the
  // fan can show through it — the result was an opaque dark crescent swallowing
  // the stars, not a glow. Projecting the hotspot to screen space and glowing
  // there composites correctly over every layer.
  function placeFlare(normal: THREE.Vector3, phase: number): void {
    // Re-guarded because TypeScript cannot carry the entry check into a closure.
    if (!(heroSection instanceof HTMLElement)) return;
    const { clientWidth: w, clientHeight: h } = heroSection;
    if (!w || !h) return;
    // The tangent point in the hotspot's direction, not the equator point — the
    // shader draws its hot core on the actual silhouette, so this is what makes
    // the DOM composite and the shader highlight the same place.
    const point = limbPoint(normal).project(camera);
    const centre = new THREE.Vector3(0, 0, 0).project(camera);
    let x = ((point.x + 1) / 2) * w;
    let y = ((1 - point.y) / 2) * h;
    const cxPx = ((centre.x + 1) / 2) * w;
    const cyPx = ((1 - centre.y) / 2) * h;

    const px = Number.parseFloat(
      heroSection.style.getPropertyValue("--mars-px") || "190",
    );

    // Any nudge outward from the silhouette is a fraction of the radius, so it
    // means the same thing at every viewport. At 0 the flare sits exactly on the
    // sheen — the same point the shader's hot core is drawn at.
    const dx = x - cxPx;
    const dy = y - cyPx;
    const len = Math.hypot(dx, dy) || 1;
    x += (dx / len) * FLARE_OUTSET_R * px;
    y += (dy / len) * FLARE_OUTSET_R * px;

    // Published as a marker, per CLAUDE.md §4: the hot spot's position is drawn
    // into a canvas, so it cannot be read back from the DOM, and inferring it
    // from canvas pixels kept giving wrong answers — the streak and the lens
    // ghosts are bright too, so any centroid or extremum over bright pixels
    // measures them rather than the core. These two make it directly checkable:
    // hypot(--hot-x - --mars-cx, --hot-y - --mars-cy) must equal --mars-px, or
    // the flare is not on the silhouette.
    heroSection.style.setProperty("--hot-x", `${x}px`);
    heroSection.style.setProperty("--hot-y", `${y}px`);

    // Superseded by HOTSPOT.md's canvas composite below. Kept, not deleted: this
    // is the three-concentric-gradients version, and it is what to fall back to
    // if the overlay ever costs too much on a low-end phone — it is three CSS
    // paints against ~12 canvas fills per frame.
    //
    // flare.style.setProperty("--core", `${px * 0.075}px`);
    // flare.style.setProperty("--bloom", `${px * 0.34}px`);
    // flare.style.setProperty("--halo", `${px * 0.8}px`);

    // The streak's long axis, tangent to the limb. In screen space the outward
    // normal at the light point IS the radial direction (dx, dy) — the same
    // vector the outset above uses — so the tangent condition
    // `longAxis . normal = 0` is satisfied by rotating it a quarter turn, with
    // no extra projection and no trig on the 3D vectors.
    hotspot?.draw(x, y, px, Math.atan2(dy, dx) + Math.PI / 2, phase);
  }

  function syncLightDir(): void {
    // The one light direction, azimuth already folded in. Everything below reads
    // it, which is what keeps lit and shadowed exactly complementary.
    const dir = lightDir.clone();
    // Camera looks at the origin, so its forward axis is just its normalised
    // position. Both shells need it to project the light onto the screen plane.
    const axis = camera.position.clone().normalize();
    // §3.7's p, exactly: the lit fraction of the VISIBLE disc. For a sphere that
    // is (1 + cos a) / 2 where a is the phase angle between the planet-to-sun
    // and planet-to-camera directions — the two unit vectors already in hand, so
    // the dot product is the whole computation. 1 when the sun is behind the
    // camera, 0 when it is directly behind the planet.
    const phase = (1 + axis.dot(dir)) / 2;
    rollSeamSide(phase);
    // One vector for both surfaces: the shader's core and the DOM overlay's are
    // the same point because they are the same number, not because two
    // derivations agree.
    const seam = nSeam(dir, axis, seamSide);
    limbGlow.material.uniforms.uLightDir.value.copy(dir);
    limbGlow.material.uniforms.uViewAxis.value.copy(axis);
    limbGlow.material.uniforms.uSeam.value.copy(seam);
    limbGlow.material.uniforms.uRimWrap.value = 0.35 + 1.75 * phase;
    placeFlare(seam, phase);
  }

  const { points: stars, material: starMaterial } = buildStarfield();
  scene.add(stars);

  // The point on the SILHOUETTE in a given screen-plane direction.
  //
  // The silhouette of a sphere in perspective is not its equator: it is the
  // circle where the view rays graze the surface, which sits R^2/d nearer the
  // camera and has radius R*sqrt(d^2 - R^2)/d. Projected, it is larger than the
  // equator by d/sqrt(d^2 - R^2) — 4.22% at 1920x1080 (16.7px of a 396px
  // radius) and 1.28% at 390x844.
  //
  // Everything that touches the limb was using the equator: the flare sat 16.7px
  // inside the shader's own highlight, and the scout's hole cut that far inside
  // the outline. STRIPE-adjacent docs all define earthPx as "the globe's
  // on-screen radius", which is this, so this is what --mars-px now publishes.
  //
  // Computed by projecting the tangent point rather than by multiplying through
  // a correction factor, so it stays exact if the camera or the model changes.
  function limbPoint(direction: THREE.Vector3): THREE.Vector3 {
    const d = camera.position.length();
    const R = marsWorldRadius;
    const k = Math.sqrt(Math.max(d * d - R * R, 1e-6));
    // Toward the camera, which for a camera looking at the origin is just its
    // normalised position.
    const axis = camera.position.clone().normalize();
    return direction
      .clone()
      .multiplyScalar((R * k) / d)
      .addScaledVector(axis, (R * R) / d);
  }

  function updateMarsPx(): void {
    if (!(heroSection instanceof HTMLElement)) return;
    const { clientWidth: w, clientHeight: h } = heroSection;
    if (!w || !h) return;
    // Any screen-plane direction gives the same radius; +X is the convenient one.
    const edge = limbPoint(new THREE.Vector3(1, 0, 0)).project(camera);
    const centre = new THREE.Vector3(0, 0, 0).project(camera);
    const px = Math.abs(edge.x - centre.x) * 0.5 * w;
    heroSection.style.setProperty("--mars-px", `${Math.max(60, px)}px`);
    // The globe's projected centre, as percentages. TYPE.md §1.1 anchors the
    // title to it rather than to the viewport, so the word stays centred on the
    // planet with no transform maths.
    heroSection.style.setProperty("--mars-cx", `${((centre.x + 1) / 2) * 100}%`);
    heroSection.style.setProperty("--mars-cy", `${((1 - centre.y) / 2) * 100}%`);
    fitTitle(px, w);
  }

  // Size the title so Mars's limb passes vertically through the MIDDLE of the
  // first B and the last S. The title is centred on the globe centre, so at the
  // title's own vertical centre the limb sits at exactly ±marsPx — which means
  // the two outer glyph CENTRES must be one diameter apart.
  //
  // Measured with a Range over the individual characters rather than derived from
  // the whole-string width: where a glyph's centre falls depends on that glyph's
  // advance, so B and S cannot be inferred from an average. Font-independent, so
  // it still holds when Avant Garde is absent and Poppins stands in.
  function fitTitle(marsPx: number, heroWidth: number): void {
    if (!(title instanceof HTMLElement)) return;
    const node = title.firstChild;
    if (!(node instanceof Text)) return;
    const text = node.data;
    const first = text.search(/\S/);
    const last = text.search(/\S\s*$/);
    if (first < 0 || last <= first) return;

    const probe = 100;
    title.style.fontSize = `${probe}px`;
    const spacing = probe * TITLE_LETTER_SPACING_EM;
    const glyphCentre = (index: number) => {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const box = range.getBoundingClientRect();
      // Each character's rect includes its trailing letter-space, which is not
      // ink; discount it or the "centre" drifts right by half a space.
      return box.left + (box.width - spacing) / 2;
    };

    const span = glyphCentre(last) - glyphCentre(first);
    if (span <= 0) return;

    // Primary rule: the two outer glyph centres a diameter apart, times the
    // length gain. `span` is measured with the CSS scaleX already in effect, so
    // when the gain and that scaleX match, the two cancel and the font size comes
    // out exactly as it would with no stretch at all — which is the point: the
    // word lengthens, the glyph height does not.
    const fitted = Math.max(
      16,
      (probe * 2 * marsPx * TITLE_LENGTH_GAIN) / span,
    );
    title.style.fontSize = `${fitted}px`;

    // Then correct against the ACTUAL rendered width. Capping on a predicted ink
    // width from scrollWidth was off by enough to leave a 2px margin at 390x844
    // where ~4 was intended — scrollWidth and the client rect do not agree here,
    // and the title sits in a zero-width flex anchor. Measuring the box that
    // really shipped and scaling once is exact whatever the font did.
    const ceiling = heroWidth * 0.99;
    const rendered = title.getBoundingClientRect().width;
    if (rendered > ceiling) {
      title.style.fontSize = `${Math.max(16, (fitted * ceiling) / rendered)}px`;
    }

    // The word's half-width, for anything that has to sit clear of it. GLITCH.md
    // §2.1 derives c3/c4's inset from the GLOBE, which was right until the title
    // grew 1/6 longer than a diameter — the word now overhangs the limb, so a
    // block that clears the globe can still land on the letters. The title is
    // the thing they collide with, so the title is what they measure from.
    if (heroSection instanceof HTMLElement) {
      heroSection.style.setProperty(
        "--title-half-w",
        `${title.getBoundingClientRect().width / 2}px`,
      );
    }

    // SCOUT-SHIP.md §6: the routes bracket the word, so they have to be
    // re-measured every time the word changes size — which is here, and only
    // here.
    placeScoutRoutes();
  }

  function frameCamera(): void {
    if (!(heroSection instanceof HTMLElement)) return;
    const { clientWidth: w, clientHeight: h } = heroSection;
    if (!w || !h) return;
    camera.aspect = w / h;
    // Pull the camera back on tall/narrow (phone) viewports so Mars and the
    // title both stay clear of the screen edges at both marking viewports. The
    // The 1.78 ceiling is set by the title, not by Mars: at 390x844 a closer
    // camera makes Mars so wide that fitTitle()'s viewport cap binds before the
    // limb rule does, and the title stops reaching past the limb.
    const dist = 9.2 * clamp(1, 1.78, 1.5 / (w / h));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    hotspot?.resize(w, h);
    updateMarsPx();
    syncLightDir();
    renderer.render(scene, camera);
  }

  new GLTFLoader().load(
    MARS_MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const scale = (MARS_RADIUS * 2) / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.sub(centre.multiplyScalar(scale));
      // Mean half-extent in the screen plane — that is what the silhouette
      // radius actually is. NOT Box3.getBoundingSphere(), which returns the
      // sphere CIRCUMSCRIBING the box (a factor of sqrt(3) too big for a cube)
      // and inflated both the title and the flare position by ~73%.
      const scaled = new THREE.Box3().setFromObject(model).getSize(
        new THREE.Vector3(),
      );
      marsWorldRadius = (scaled.x + scaled.y) / 4 || MARS_RADIUS;
      marsGroup.add(model);
      marsGroup.add(limbGlow.mesh);
      marsMesh = model;
      updateMarsPx();
      renderer.render(scene, camera);
    },
    undefined,
    (error) => {
      console.error("Mars model failed to load, using fallback sphere.", error);
      const fallback = buildFallbackMars();
      marsGroup.add(fallback);
      marsGroup.add(limbGlow.mesh);
      marsMesh = fallback;
      updateMarsPx();
      renderer.render(scene, camera);
    },
  );

  frameCamera();
  window.addEventListener("resize", frameCamera);
  // Poppins arriving after first paint changes the measured width, so re-fit.
  void document.fonts?.ready.then(() => frameCamera());

  if (prefersReducedMotion) {
    return;
  }

  let rafId: number | null = null;

  // Checked at the END of every tick, so a frame already in flight cannot

  // re-arm the loop after the observer has stopped it.

  let paused = false;

  function tick(time: number): void {
    if (marsMesh) marsMesh.rotation.y += MARS_ROTATION_SPEED;
    stars.rotation.y = time * 0.0000135;
    stars.rotation.x = Math.sin(time * 0.000021) * 0.05;
    starMaterial.uniforms.uTime.value = time / 1000; // §A.3's 0.55 is rad/s
    placeSun(time);
    syncLightDir();
    renderer.render(scene, camera);
    // PERFORMANCE.md §2.2: draw on demand, never on a permanent loop. Cancelling
    // the queued frame is not enough on its own — a tick already in flight when
    // the observer fires simply re-schedules itself and the loop resurrects,
    // which is why the hero kept rendering a 3D globe, a 2,600-point starfield
    // and the hotspot composite at 144 fps while the user was in the field,
    // competing with the pointer stream for every frame (§5.2).
    // The IntersectionObserver below was not reporting non-intersection, so the
    // loop kept running with the hero fully scrolled past. Reading the rect is
    // one layout query per frame and cannot disagree with what is on screen —
    // the observer stays as the fast path, this is the check that decides.
    const r = heroSection instanceof HTMLElement ? heroSection.getBoundingClientRect() : null;
    if (paused || (r && (r.bottom <= 0 || r.top >= window.innerHeight))) {
      rafId = null;
      // The rAF work stops here, but the scout ships, the title float and the
      // CTA are CSS animations, and CSS keeps those running off-screen — two
      // 60s infinite loops translating five layers each across the viewport,
      // forever, behind the archive. Pausing them is a class, and it is the
      // rest of the same idea: nothing out of sight should cost a frame.
      heroSection?.classList.add("is-idle");
      return;
    }
    heroSection?.classList.remove("is-idle");
    rafId = requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      paused = !entry.isIntersecting;
      if (entry.isIntersecting && rafId === null) {
        rafId = requestAnimationFrame(tick);
      } else if (!entry.isIntersecting && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    { threshold: 0 },
  );
  observer.observe(heroSection);

  // The observer stops the loop reliably but never restarts it, so scrolling
  // back to the hero left a frozen globe. A passive scroll listener is the
  // restart: it costs nothing while the loop is running (the guard returns
  // immediately) and it cannot miss the case the observer misses.
  const resume = (): void => {
    if (rafId !== null || !(heroSection instanceof HTMLElement)) return;
    const r = heroSection.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) {
      paused = false;
      heroSection.classList.remove("is-idle");
      rafId = requestAnimationFrame(tick);
    }
  };
  window.addEventListener("scroll", resume, { passive: true });
  window.addEventListener("resize", resume, { passive: true });
}
