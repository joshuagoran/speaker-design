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
}

/** A rotatable 3D view of whatever `build` returns, on the themed stage (floor, grid, lights). */
export function SceneView3D({ buildKey, build, fit = fitFootprint }: Props) {
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
  }>({ rotY: 0.6, rotX: 0.35, drag: false, lx: 0, ly: 0, zoom: 1 });
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
    scene.add(new THREE.HemisphereLight(stage.sky, stage.ground, stage.hemi));
    const key = new THREE.DirectionalLight(stage.sky, stage.key);
    key.position.set(40, 80, 30);
    scene.add(key);

    const group = latest.current.build();
    scene.add(group);

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: stage.floor, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new THREE.GridHelper(120, 10, stage.gridMajor, stage.gridMinor));

    group.position.y = 0;

    // Frame from the real bounding box, so nothing is cropped at any aspect ratio.
    const bbox = new THREE.Box3().setFromObject(group);
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
  }, [builtKey, theme]);

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
