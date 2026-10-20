import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { useThemeName } from "../../hooks/useTheme";
import { STAGE } from "../../styles/palette";
import { FRAME_BOX_KEY, VIEW_FOV_DEG, fitFootprint, type SceneFit } from "./sceneFraming";

interface Props {
  /** changes exactly when the scene does (the JSON of the builder's inputs) */
  buildKey: string;
  /** builds the scene's group, in inches, the floor at y = 0; read when `buildKey` changes */
  build: () => THREE.Group;
  /** how far back the camera sits for the scene (default: the PA stack's `fitFootprint`) */
  fit?: SceneFit;
  /** where the camera starts: its turn and tilt, radians, and zoom (default: the view's own; the render tool sets it) */
  start?: Partial<SceneStart>;
  /** how the camera moves (default: turn, tilt and zoom as every design view does, no pan) */
  controls?: Partial<SceneControls>;
  /** the stage's floor and grid drawn under the scene (default); false: the scene draws its own floor */
  stage?: boolean;
}

/** How the camera moves: whether a drag can pan it, its zoom range, and its highest tilt, radians. */
export interface SceneControls {
  /** a right drag, a drag with Shift, Ctrl or ⌘ held, or a two-finger drag moves the view sideways and up */
  pan: boolean;
  zoom: [min: number, max: number];
  tiltMax: number;
}
/** Every design view's camera moves. */
const CONTROLS: SceneControls = { pan: false, zoom: [0.45, 2.2], tiltMax: 1.2 };

/** The camera's turn round the scene and tilt over it, radians, and its zoom (distance over the fit's). */
export interface SceneStart {
  rotY: number;
  rotX: number;
  zoom: number;
}
/** Where every view's camera starts. */
const START: SceneStart = { rotY: 0.6, rotX: 0.35, zoom: 1 };

/** A rotatable 3D view of whatever `build` returns, on the themed stage (floor, grid, lights). */
export function SceneView3D({
  buildKey,
  build,
  fit = fitFootprint,
  start,
  controls,
  stage: withStage = true,
}: Props) {
  const moves = useRef<SceneControls>({ ...CONTROLS, ...controls });
  moves.current = { ...CONTROLS, ...controls };
  const mount = useRef<HTMLDivElement>(null);
  // the stage (floor, grid, lights) follows the theme; the scene is rebuilt when it changes
  const theme = useThemeName();
  const state = useRef<{
    rotY: number;
    rotX: number;
    drag: boolean;
    /** the drag pans the view rather than turning it */
    panning: boolean;
    lx: number;
    ly: number;
    zoom: number;
    /** how far the view is panned off the scene's center, in */
    pan: THREE.Vector3;
  }>({
    ...START,
    ...start,
    drag: false,
    panning: false,
    lx: 0,
    ly: 0,
    pan: new THREE.Vector3(),
  });
  // the latest builder and fit, read when the key says the scene changed
  const latest = useRef({ build, fit, withStage });
  latest.current = { build, fit, withStage };
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
    // a scene's clipping planes (the Space's beams stop at the walls)
    renderer.localClippingEnabled = true;
    el.appendChild(renderer.domElement);
    const st = state.current;
    const v: ViewState = {
      renderer,
      cam,
      scene: null,
      frame: null,
      figure: null,
      fit: () => {},
      // aims the camera at the scene from the view's rotation and zoom, and draws it
      draw: () => {
        const { scene, frame } = v;
        if (!scene || !frame) return;
        const target = frame.target.clone().add(st.pan);
        const dist = frame.baseDist * st.zoom;
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
    /** the two fingers' middle, px, as a pinch last read it */
    let mid0 = { x: 0, y: 0 };
    const zoomTo = (zoom: number) => {
      const [lo, hi] = moves.current.zoom;
      st.zoom = Math.max(lo, Math.min(hi, zoom));
    };
    /** moves the view by a drag of dx, dy px: the scene follows the pointer, across the screen and up it */
    const panBy = (dx: number, dy: number) => {
      if (!v.frame) return;
      const perPx =
        (2 * v.frame.baseDist * st.zoom * Math.tan((VIEW_FOV_DEG * Math.PI) / 360)) /
        (el.clientHeight || H);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      st.pan.addScaledVector(right, -dx * perPx).addScaledVector(up, dy * perPx);
    };

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
        mid0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      st.drag = true;
      st.panning = moves.current.pan && (e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey);
      st.lx = e.clientX;
      st.ly = e.clientY;
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) zoomTo(zoom0 * (pinch0 / d));
        // the fingers' middle moving pans the view, where it can pan
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (moves.current.pan) panBy(mid.x - mid0.x, mid.y - mid0.y);
        mid0 = mid;
        return; // pinching, not rotating
      }
      if (!st.drag) return;
      if (st.panning) panBy(e.clientX - st.lx, e.clientY - st.ly);
      else {
        // the model turns the way the pointer moves: dragging right turns its front to the right (the camera goes left)
        st.rotY -= (e.clientX - st.lx) * 0.01;
        st.rotX = Math.max(
          0.05,
          Math.min(moves.current.tiltMax, st.rotX + (e.clientY - st.ly) * 0.006),
        );
      }
      st.lx = e.clientX;
      st.ly = e.clientY;
    };
    // a right drag pans, where the view can pan: no menu
    const onMenu = (e: MouseEvent) => {
      if (moves.current.pan) e.preventDefault();
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
      zoomTo(st.zoom * (1 + e.deltaY * 0.0012));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onMenu);

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
      el.removeEventListener("contextmenu", onMenu);
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
    scene.add(new THREE.HemisphereLight(stage.sky, stage.ground, stage.hemi));
    const key = new THREE.DirectionalLight(stage.sky, stage.key);
    key.position.set(40, 80, 30);
    scene.add(key);

    const group = latest.current.build();
    scene.add(group);

    if (latest.current.withStage) {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ color: stage.floor, roughness: 1 }),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
      scene.add(new THREE.GridHelper(120, 10, stage.gridMajor, stage.gridMinor));
    }

    group.position.y = 0;

    // Frame from the real bounding box (or the box the scene names), so nothing is cropped at any aspect ratio.
    const named: unknown = group.userData[FRAME_BOX_KEY];
    const bbox = named instanceof THREE.Box3 ? named : new THREE.Box3().setFromObject(group);
    const distAt = latest.current.fit(bbox);
    const frame: SceneFrame = { target: bbox.getCenter(new THREE.Vector3()), baseDist: 0 };
    // the camera's near and far planes fit the scene's size at every zoom
    const radius = bbox.getSize(new THREE.Vector3()).length() / 2;
    v.fit = (aspect: number) => {
      frame.baseDist = distAt(aspect);
      v.cam.near = Math.max(0.1, radius / 500);
      v.cam.far = Math.max(1000, 2 * (frame.baseDist * moves.current.zoom[1] + radius));
      v.cam.updateProjectionMatrix();
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
  }, [builtKey, theme]);

  return <div ref={mount} className="w-full h-full cursor-grab" />;
}

/** The view's renderer and camera, kept for the component's life, and the scene it shows now. */
interface ViewState {
  renderer: THREE.WebGLRenderer;
  cam: THREE.PerspectiveCamera;
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
