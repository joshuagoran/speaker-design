import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { useThemeName } from "../../hooks/useTheme";
import { STAGE } from "../../styles/palette";
import { VIEW_FOV_DEG, fitFootprint, type SceneFit } from "./sceneFraming";

interface Props {
  /** changes exactly when the scene does (the JSON of the builder's inputs) */
  buildKey: string;
  /** builds the scene's group, in inches, the floor at y = 0; read when `buildKey` changes */
  build: () => THREE.Group;
  /** how far back the camera sits for the scene (default: the PA stack's `fitFootprint`) */
  fit?: SceneFit;
  /** where the camera starts: its turn and tilt, radians, and zoom (default: the view's own; the render tool sets it) */
  start?: Partial<SceneStart>;
  /** the flat style (a trial): even light, stepped shading, an outline on every edge, and a soft shadow, no grid */
  flat?: boolean;
}

/** The camera's turn round the scene and tilt over it, radians, and its zoom (distance over the fit's). */
export interface SceneStart {
  rotY: number;
  rotX: number;
  zoom: number;
}
/** Where every view's camera starts. */
const START: SceneStart = { rotY: 0.6, rotX: 0.35, zoom: 1 };

/** A rotatable 3D view of whatever `build` returns, on the themed stage (floor, grid, lights). */
export function SceneView3D({ buildKey, build, fit = fitFootprint, start, flat = false }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  // the stage (floor, grid, lights) follows the theme; the scene is rebuilt when it changes
  const theme = useThemeName();
  const state = useRef<{
    rotY: number;
    rotX: number;
    drag: boolean;
    lx: number;
    ly: number;
    zoom: number;
  }>({ ...START, ...start, drag: false, lx: 0, ly: 0 });
  // the latest builder and fit, read when the key says the scene changed
  const latest = useRef({ build, fit });
  latest.current = { build, fit };
  // Rebuild the scene only when the caller's key changes (the parent recreates the builder's inputs every render), and
  // at most every 120 ms while a slider is dragged, so the controls stay responsive.
  const [builtKey, setBuiltKey] = useState(buildKey);
  const lastBuild = useRef(0);
  useEffect(() => {
    if (buildKey === builtKey) return;
    const wait = Math.max(0, 120 - (performance.now() - lastBuild.current));
    const pending = setTimeout(() => {
      lastBuild.current = performance.now();
      setBuiltKey(buildKey);
    }, wait);
    return () => clearTimeout(pending);
  }, [buildKey, builtKey]);

  // One renderer, camera and render loop for the component's life (a browser keeps only a few WebGL contexts, and each
  // renderer takes one); each rebuild swaps the scene in `view` and frees the old scene's GPU resources.
  const view = useRef<ViewState | null>(null);
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const W = el.clientWidth || 640,
      H = el.clientHeight || 560;
    const cam = new THREE.PerspectiveCamera(VIEW_FOV_DEG, W / H, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    const st = state.current;
    const v: ViewState = {
      renderer,
      scene: null,
      frame: null,
      figure: null,
      fit: () => {},
      // aims the camera at the scene from the view's rotation and zoom, and draws it
      draw: () => {
        const { scene, frame } = v;
        if (!scene || !frame) return;
        const { target, baseDist } = frame;
        const dist = baseDist * st.zoom;
        cam.position.set(
          target.x + dist * Math.sin(st.rotY) * Math.cos(st.rotX),
          target.y + dist * Math.sin(st.rotX),
          target.z + dist * Math.cos(st.rotY) * Math.cos(st.rotX),
        );
        cam.lookAt(target);
        v.figure?.quaternion.copy(cam.quaternion);
        renderer.render(scene, cam);
      },
    };
    view.current = v;

    // Pointer handling. touch-action on the canvas is pan-y, so a mostly
    // vertical swipe scrolls the page and anything else reaches us here.
    const pts = new Map<number, { x: number; y: number }>();
    let pinch0 = 0,
      zoom0 = 1;

    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = st.zoom;
      }
      st.drag = true;
      st.lx = e.clientX;
      st.ly = e.clientY;
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) st.zoom = Math.max(0.45, Math.min(2.2, zoom0 * (pinch0 / d)));
        return; // pinching, not rotating
      }
      if (!st.drag) return;
      st.rotY += (e.clientX - st.lx) * 0.01;
      st.rotX = Math.max(0.05, Math.min(1.2, st.rotX + (e.clientY - st.ly) * 0.006));
      st.lx = e.clientX;
      st.ly = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already gone */
      }
      if (pts.size < 2) pinch0 = 0;
      if (pts.size === 0) st.drag = false;
      else {
        const p = [...pts.values()][0];
        st.lx = p.x;
        st.ly = p.y;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.zoom = Math.max(0.45, Math.min(2.2, st.zoom * (1 + e.deltaY * 0.0012)));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // Keep the canvas and the framing correct through rotation and resize.
    const resize = () => {
      const w = el.clientWidth || W,
        h = el.clientHeight || H;
      if (!w || !h) return;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      v.fit(w / h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("orientationchange", resize);

    let raf: number;
    const tick = () => {
      v.draw();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      if (v.scene) disposeScene(v.scene);
      v.scene = v.frame = v.figure = null;
      view.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // Each rebuild: the old scene's geometries, materials and textures freed, then the new scene built and framed.
  useEffect(() => {
    const v = view.current;
    const el = mount.current;
    if (!v || !el) return;
    if (v.scene) disposeScene(v.scene);
    const scene = new THREE.Scene();
    const stage = STAGE[theme];
    // the flat style: more even light, a weaker key
    scene.add(
      new THREE.HemisphereLight(
        stage.sky,
        stage.ground,
        flat ? stage.hemi * FLAT_HEMI : stage.hemi,
      ),
    );
    const key = new THREE.DirectionalLight(stage.sky, flat ? stage.key * FLAT_KEY : stage.key);
    key.position.set(40, 80, 30);
    scene.add(key);

    const group = latest.current.build();
    if (flat) flatten(group, stage.outline);
    scene.add(group);

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: stage.floor, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    if (!flat) scene.add(new THREE.GridHelper(120, 10, stage.gridMajor, stage.gridMinor));

    group.position.y = 0;

    // Frame from the real bounding box, so nothing is cropped at any aspect ratio.
    const bbox = new THREE.Box3().setFromObject(group);
    if (flat) scene.add(contactShadow(bbox));
    const distAt = latest.current.fit(bbox);
    const frame: SceneFrame = { target: bbox.getCenter(new THREE.Vector3()), baseDist: 0 };
    v.fit = (aspect: number) => {
      frame.baseDist = distAt(aspect);
    };
    v.fit((el.clientWidth || 640) / (el.clientHeight || 560));
    v.scene = scene;
    v.frame = frame;
    v.figure = group.getObjectByName("scale-figure") ?? null;
    // the GPU's live geometries and textures once this rebuild is drawn, and the rebuilds so far, for the memory check
    // (tests/three-memory-check.mjs)
    v.draw();
    const { geometries, textures } = v.renderer.info.memory;
    el.dataset.geometries = String(geometries);
    el.dataset.textures = String(textures);
    el.dataset.rebuilds = String(Number(el.dataset.rebuilds ?? 0) + 1);
  }, [builtKey, theme, flat]);

  return <div ref={mount} className="w-full h-full cursor-grab" />;
}

/** The view's renderer and camera, kept for the component's life, and the scene it shows now. */
interface ViewState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene | null;
  frame: SceneFrame | null;
  /** the scale figure, turned to face the camera every frame */
  figure: THREE.Object3D | null;
  /** fits the camera's distance to the scene at an aspect ratio */
  fit: (aspect: number) => void;
  /** aims the camera and draws the scene */
  draw: () => void;
}

/** Where the render loop aims the camera for a scene, and how far back it sits at zoom 1. */
interface SceneFrame {
  target: THREE.Vector3;
  baseDist: number;
}

/** The flat style's light: the sky light's share and the key light's, of the stage's. */
const FLAT_HEMI = 1;
const FLAT_KEY = 0.5;
/** The flat style's shading steps (a lit face's share of its color) and the angle past which an edge is outlined, °. */
const FLAT_STEPS = [140, 195, 235];
const OUTLINE_ANGLE_DEG = 30;
/** A see-through part (the cutaway's ghost) more transparent than this gets no outline. */
const OUTLINE_MIN_OPACITY = 0.6;
/** The soft shadow: its size over the scene's footprint, its darkness at the middle, and its texture's size, px. */
const SHADOW_SPREAD = 1.5;
const SHADOW_ALPHA = 0.28;
const SHADOW_PX = 128;

/**
 * The flat style on a built scene: each lit part's material swapped for a stepped toon one in its color, and an outline
 * on its edges (not on a see-through ghost).
 */
function flatten(group: THREE.Group, outline: number) {
  const steps = new Uint8Array(FLAT_STEPS);
  const gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const lineMaterial = new THREE.LineBasicMaterial({ color: outline });
  const toons = new Map<THREE.Material, THREE.Material>();
  const toon = (m: THREE.Material) => {
    if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshLambertMaterial))
      return m;
    const made = toons.get(m);
    if (made) return made;
    const next = new THREE.MeshToonMaterial({
      color: m.color,
      gradientMap: gradient,
      transparent: m.transparent,
      opacity: m.opacity,
      side: m.side,
      depthWrite: m.depthWrite,
    });
    toons.set(m, next);
    m.dispose();
    return next;
  };
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  for (const mesh of meshes) {
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = Array.isArray(mesh.material) ? list.map(toon) : toon(list[0]);
    const ghost = list.some((m) => m.transparent && m.opacity < OUTLINE_MIN_OPACITY);
    if (!ghost)
      mesh.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry, OUTLINE_ANGLE_DEG),
          lineMaterial,
        ),
      );
  }
}

/** A soft round shadow on the floor under the scene's footprint (`bbox`), fading to clear at its edge. */
function contactShadow(bbox: THREE.Box3) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SHADOW_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = SHADOW_PX / 2;
    const fade = ctx.createRadialGradient(r, r, 0, r, r, r);
    fade.addColorStop(0, `rgba(0,0,0,${SHADOW_ALPHA})`);
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, SHADOW_PX, SHADOW_PX);
  }
  const size = bbox.getSize(new THREE.Vector3());
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * SHADOW_SPREAD, size.z * SHADOW_SPREAD),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  const center = bbox.getCenter(new THREE.Vector3());
  shadow.position.set(center.x, 0.05, center.z);
  return shadow;
}

/** Frees a scene's geometries, materials and the textures they hold on the GPU (shared ones once each). */
function disposeScene(scene: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
    m.dispose();
  });
}
