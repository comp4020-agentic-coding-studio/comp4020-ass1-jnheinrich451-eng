import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
const STAR_COUNT = 2200;

// Title width as a multiple of Mars's on-screen diameter: just over 1, so the
// B's left stem and the S's right bowl sit outside the silhouette and every
// letter between them is inside it.
const TITLE_OVERHANG = 1.08;
// Must match #hero-title's letter-spacing in styles.css — measured width
// includes a trailing letter-space that isn't ink, and discounting it is what
// makes the outermost letters land on the limb rather than just inside it.
const TITLE_LETTER_SPACING_EM = 0.08;

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildStarfield(): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const positions = new Float32Array(STAR_COUNT * 3);
  const phases = new Float32Array(STAR_COUNT);
  const tints = new Float32Array(STAR_COUNT * 3);
  // Per-star twinkle character. One shared sine gave every star the same beat,
  // which reads as a pulsing grid rather than a sky; these three attributes are
  // what let some stars blink fast and others burn steady.
  const rates = new Float32Array(STAR_COUNT); // how fast it varies
  const flickers = new Float32Array(STAR_COUNT); // how much of its light varies
  const mags = new Float32Array(STAR_COUNT); // base brightness (and size)

  // White through blue-white, weighted towards white — no gold, no purple.
  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xffffff),
    new THREE.Color(0xeaf2ff),
    new THREE.Color(0xeaf2ff),
    new THREE.Color(0xc6d8ff),
    new THREE.Color(0x9fc0ff),
  ];

  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 30 + Math.random() * 45;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    phases[i] = Math.random() * Math.PI * 2;

    const roll = Math.random();
    if (roll < 0.08) {
      // Bright and steady: strong constant light, slow lumen variation only.
      mags[i] = rand(1.9, 2.7);
      flickers[i] = rand(0.08, 0.2);
      rates[i] = rand(0.2, 0.55);
    } else if (roll < 0.34) {
      // Fast blinkers.
      mags[i] = rand(0.65, 1.05);
      flickers[i] = rand(0.5, 0.82);
      rates[i] = rand(2.2, 4.2);
    } else {
      mags[i] = rand(0.75, 1.3);
      flickers[i] = rand(0.22, 0.45);
      rates[i] = rand(0.7, 1.7);
    }

    const tint = palette[Math.floor(Math.random() * palette.length)];
    tints[i * 3] = tint.r;
    tints[i * 3 + 1] = tint.g;
    tints[i * 3 + 2] = tint.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute("rate", new THREE.BufferAttribute(rates, 1));
  geometry.setAttribute("flicker", new THREE.BufferAttribute(flickers, 1));
  geometry.setAttribute("mag", new THREE.BufferAttribute(mags, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float phase;
      attribute vec3 tint;
      attribute float rate;
      attribute float flicker;
      attribute float mag;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vTint;
      varying float vLumen;
      void main() {
        vTint = tint;
        // Two detuned sines so the variation never reads as a clean loop.
        float t = uTime * 0.0016 * rate + phase * 6.2831;
        float wave = 0.5 + 0.5 * (0.72 * sin(t) + 0.28 * sin(t * 2.37 + 1.1));
        vLumen = mag * (1.0 - flicker + flicker * wave);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixelRatio * (0.8 + vLumen * 1.5) * (60.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vTint;
      varying float vLumen;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        // Squared term concentrates a hot centre inside the soft disc, so the
        // bright stars read as points of light rather than grey blobs.
        float a = (core * 0.45 + core * core * core * 0.55) * vLumen;
        gl_FragColor = vec4(vTint, clamp(a, 0.0, 1.0));
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
      uLimb: { value: new THREE.Color(0xdce9ff) }, // cool blue-white
      uHot: { value: new THREE.Color(0xffffff) },
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
      uniform vec3 uLimb;
      uniform vec3 uHot;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        // High exponent keeps the band tight against the silhouette instead of
        // washing the whole disc — the reference's highlight is a hard edge.
        float edge = pow(1.0 - max(dot(vNormalW, vViewW), 0.0), 12.0);
        float lit = max(dot(vNormalW, uLightDir), 0.0);
        float i = edge * (0.05 + 2.1 * pow(lit, 1.5));
        gl_FragColor = vec4(mix(uLimb, uHot, clamp(lit * 1.2, 0.0, 1.0)),
                            clamp(i, 0.0, 1.0));
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
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  scene.add(new THREE.AmbientLight(0x1a1030, 0.6));
  const sun = new THREE.DirectionalLight(0xfff3e0, 3.4);
  scene.add(sun);

  // The sun sweeps a narrow arc rather than a full orbit. A full orbit put Mars
  // fully in shadow for half of every ~70s cycle, so the page could be caught
  // dark; this range keeps it side-lit from the front-left at all times, which
  // is also the reference's framing — a bright limb with a visible terminator.
  const SUN_ANGLE = -1.05; // radians from straight-behind-camera (~60 deg left)
  const SUN_SWING = 0.28;
  const SUN_DISTANCE = 6;
  function placeSun(time: number): void {
    const angle = SUN_ANGLE + Math.sin(time * 0.00006) * SUN_SWING;
    sun.position.set(
      Math.sin(angle) * SUN_DISTANCE,
      2,
      Math.cos(angle) * SUN_DISTANCE,
    );
  }
  placeSun(0);

  const marsGroup = new THREE.Group();
  scene.add(marsGroup);
  let marsMesh: THREE.Object3D | null = null;

  const limbGlow = buildLimbGlow(MARS_RADIUS);
  const title = document.getElementById("hero-title");

  // The shell's highlight has to follow the sun as it orbits, or the lit limb
  // and the shaded surface drift apart.
  function syncLightDir(): void {
    limbGlow.material.uniforms.uLightDir.value
      .copy(sun.position)
      .normalize();
  }

  const { points: stars, material: starMaterial } = buildStarfield();
  scene.add(stars);

  function updateMarsPx(): void {
    if (!(heroSection instanceof HTMLElement)) return;
    const { clientWidth: w, clientHeight: h } = heroSection;
    if (!w || !h) return;
    const edge = new THREE.Vector3(MARS_RADIUS, 0, 0).project(camera);
    const centre = new THREE.Vector3(0, 0, 0).project(camera);
    const px = Math.abs(edge.x - centre.x) * 0.5 * w;
    heroSection.style.setProperty("--mars-px", `${Math.max(60, px)}px`);
    fitTitle(px, w);
  }

  // Size the title by measuring it rather than by guessing an em-per-character
  // ratio: the CSS clamp in styles.css is only the no-JS fallback, and it can't
  // know whether Poppins actually loaded. Measured at a probe size, then scaled
  // once — so the outermost letters land on Mars's limb at any viewport and with
  // any fallback font.
  function fitTitle(marsPx: number, heroWidth: number): void {
    if (!(title instanceof HTMLElement)) return;
    const probe = 100;
    title.style.fontSize = `${probe}px`;
    const ink = title.scrollWidth - probe * TITLE_LETTER_SPACING_EM;
    if (ink <= 0) return;
    const wanted = Math.min(marsPx * 2 * TITLE_OVERHANG, heroWidth * 0.94);
    title.style.fontSize = `${Math.max(16, (probe * wanted) / ink)}px`;
  }

  function frameCamera(): void {
    if (!(heroSection instanceof HTMLElement)) return;
    const { clientWidth: w, clientHeight: h } = heroSection;
    if (!w || !h) return;
    camera.aspect = w / h;
    // Pull the camera back on tall/narrow (phone) viewports so Mars and the
    // title both stay clear of the screen edges at both marking viewports. The
    // 1.78 ceiling is set by the title, not by Mars: at 390x844 a closer camera
    // makes Mars wider than 94vw/TITLE_OVERHANG, so fitTitle()'s viewport cap
    // binds first and the title ends up *inside* the limb instead of crossing it.
    const dist = 9.2 * clamp(1, 1.78, 1.5 / (w / h));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
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
    starMaterial.uniforms.uTime.value = time;
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
