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

// §3.7's azimuth, in degrees, positive counter-clockwise on screen. It rotates
// the SHADOW axis about the view axis and nothing else: the star, its rim and
// its flare all stay anchored to the true light direction, so the highlight
// never detaches from the source. 90 puts the terminator perpendicular to the
// star, which is what turns the day/night boundary into a bar across the globe.
//
// Two things follow from rotating about the VIEW axis specifically. It is
// deliberately non-physical — §3.7 calls this "the cinematic one, where the
// light rakes across the world from an angle the star does not account for" —
// and phase is exactly invariant under it, since a rotation about an axis
// preserves every vector's component along that axis. So azimuth moves where the
// shadow lies without touching how wide it is, which is the separation §3.7
// claims. 0 restores the physically correct case.
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

        // The concentrated light point, per REFLECTIVE-COVER.md line 60. The
        // terminator meets the silhouette where N is perpendicular to BOTH the
        // light and the view, i.e. at N = ±(L×V)/|L×V| — two points. Their chord
        // is centred on the globe centre, and the normal to that chord taken
        // inside the silhouette plane is V×(L×V) = L − V(V·L): the light
        // direction projected onto the screen plane. So the hotspot normal is
        // that vector, in closed form — no iteration, no marching the limb.
        vec3 nHot = normalize(uLightDir - uViewAxis * dot(uViewAxis, uLightDir));
        float aim = max(dot(vNormalW, nHot), 0.0);

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
        float i = visible * edge * (1.5 * wrapped + 4.0 * core + 1.1 * bloom);
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

  // Where the star actually is. The DirectionalLight is placed at this rotated
  // by AZIMUTH_DEG, so the shading terminator rolls; everything belonging to the
  // star itself — rim, hotspot, flare, phase — reads starDir instead, which is
  // what keeps the highlight on the source (§3.7's azimuth note).
  const starDir = new THREE.Vector3();
  function placeSun(time: number): void {
    const angle = time * SUN_RATE;
    starDir
      .set(Math.sin(angle) * SUN_DISTANCE, 2, Math.cos(angle) * SUN_DISTANCE)
      .normalize();
    sun.position
      .copy(starDir)
      .applyAxisAngle(
        camera.position.clone().normalize(),
        -(AZIMUTH_DEG * Math.PI) / 180,
      )
      .multiplyScalar(SUN_DISTANCE);
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


  // The shell's highlight has to follow the sun as it orbits, or the lit limb
  // and the shaded surface drift apart.
  // The light-point normal, in closed form: L − V(V·L). See REFLECTIVE-COVER.md
  // line 60 — this is where the terminator's chord midpoint normal crosses the
  // silhouette.
  function nHot(light: THREE.Vector3, axis: THREE.Vector3): THREE.Vector3 {
    return light
      .clone()
      .addScaledVector(axis, -axis.dot(light))
      .normalize();
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
    const point = normal.clone().multiplyScalar(marsWorldRadius).project(camera);
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

    // Superseded by HOTSPOT.md's canvas composite below. Kept, not deleted: this
    // is the three-concentric-gradients version, and it is what to fall back to
    // if the overlay ever costs too much on a low-end phone — it is three CSS
    // paints against ~12 canvas fills per frame.
    //
    // flare.style.setProperty("--hot-x", `${x}px`);
    // flare.style.setProperty("--hot-y", `${y}px`);
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
    // starDir, NOT sun.position — the light has been rolled by the azimuth and
    // the star has not.
    const dir = starDir.clone();
    // Camera looks at the origin, so its forward axis is just its normalised
    // position. Both shells need it to project the light onto the screen plane.
    const axis = camera.position.clone().normalize();
    // §3.7's p, exactly: the lit fraction of the VISIBLE disc. For a sphere that
    // is (1 + cos a) / 2 where a is the phase angle between the planet-to-sun
    // and planet-to-camera directions — the two unit vectors already in hand, so
    // the dot product is the whole computation. 1 when the sun is behind the
    // camera, 0 when it is directly behind the planet.
    const phase = (1 + axis.dot(dir)) / 2;
    limbGlow.material.uniforms.uLightDir.value.copy(dir);
    limbGlow.material.uniforms.uViewAxis.value.copy(axis);
    limbGlow.material.uniforms.uRimWrap.value = 0.35 + 1.75 * phase;
    placeFlare(nHot(dir, axis), phase);
  }

  const { points: stars, material: starMaterial } = buildStarfield();
  scene.add(stars);

  function updateMarsPx(): void {
    if (!(heroSection instanceof HTMLElement)) return;
    const { clientWidth: w, clientHeight: h } = heroSection;
    if (!w || !h) return;
    const edge = new THREE.Vector3(marsWorldRadius, 0, 0).project(camera);
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

  function tick(time: number): void {
    if (marsMesh) marsMesh.rotation.y += MARS_ROTATION_SPEED;
    stars.rotation.y = time * 0.0000135;
    stars.rotation.x = Math.sin(time * 0.000021) * 0.05;
    starMaterial.uniforms.uTime.value = time / 1000; // §A.3's 0.55 is rad/s
    placeSun(time);
    syncLightDir();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
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
}
