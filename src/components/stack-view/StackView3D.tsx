import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { buildStackScene, type Props } from "./buildStackScene";
import { useThemeName } from "../../hooks/useTheme";
import { STAGE } from "../../styles/palette";

/** Rotatable 3D view of the PA stack. */
export function StackView3D({
  sub,
  mid,
  horn,
  plinth,
  cutaway,
  portStyle,
  layout,
  baffleColor,
  portGeom,
  wall = 0.75,
  inset = 0.75,
  cabFinish = "birch",
  spacerH = 20,
}: Props) {
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
  // Rebuild the scene only when the geometry actually changes (the parent recreates these objects every
  // render), and at most every 120 ms while a slider is dragged, so the controls stay responsive.
  const geoKey = JSON.stringify([
    sub,
    mid,
    horn,
    plinth,
    cutaway,
    portStyle,
    layout,
    baffleColor,
    portGeom,
    wall,
    inset,
    cabFinish,
    spacerH,
  ]);
  const [builtKey, setBuiltKey] = useState(geoKey);
  const lastBuild = useRef(0);
  useEffect(() => {
    if (geoKey === builtKey) return;
    const wait = Math.max(0, 120 - (performance.now() - lastBuild.current));
    const pending = setTimeout(() => {
      lastBuild.current = performance.now();
      setBuiltKey(geoKey);
    }, wait);
    return () => clearTimeout(pending);
  }, [geoKey, builtKey]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const W = el.clientWidth || 640,
      H = el.clientHeight || 560;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    const stage = STAGE[theme];
    scene.add(new THREE.HemisphereLight(stage.sky, stage.ground, stage.hemi));
    const key = new THREE.DirectionalLight(stage.sky, stage.key);
    key.position.set(40, 80, 30);
    scene.add(key);

    const group = buildStackScene({
      sub,
      mid,
      horn,
      plinth,
      cutaway,
      portStyle,
      layout,
      baffleColor,
      portGeom,
      wall,
      inset,
      cabFinish,
      spacerH,
    });
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

    // Frame from the real bounding box so nothing is cropped at any aspect
    // ratio. The horizontal radius is taken as the diagonal of the footprint
    // so the fit holds through a full rotation rather than only head-on.
    const bbox = new THREE.Box3().setFromObject(group);
    const bc = bbox.getCenter(new THREE.Vector3());
    const bs = bbox.getSize(new THREE.Vector3());
    const target = new THREE.Vector3(bc.x, bc.y, bc.z);
    const halfH = bs.y / 2;
    const halfW = Math.sqrt(bs.x * bs.x + bs.z * bs.z) / 2;
    const tanV = Math.tan((cam.fov * Math.PI) / 360);
    let baseDist = halfH / tanV;
    const fit = (aspect: number) => {
      baseDist = Math.max(halfH / tanV, halfW / (aspect * tanV)) * 1.18;
    };
    fit(W / H);

    const st = state.current;

    // Pointer handling. touch-action on the canvas is pan-y, so a mostly
    // vertical swipe scrolls the page and anything else reaches us here.
    const pts = new Map<number, { x: number; y: number }>();
    let pinch0 = 0,
      zoom0 = 1;

    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
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
      } catch (err) {
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
      fit(w / h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("orientationchange", resize);

    const figure = group.getObjectByName("scale-figure");
    let raf: number;
    const tick = () => {
      const dist = baseDist * st.zoom;
      cam.position.set(
        target.x + dist * Math.sin(st.rotY) * Math.cos(st.rotX),
        target.y + dist * Math.sin(st.rotX),
        target.z + dist * Math.cos(st.rotY) * Math.cos(st.rotX),
      );
      cam.lookAt(target);
      if (figure) figure.quaternion.copy(cam.quaternion);
      renderer.render(scene, cam);
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
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [builtKey, theme]);

  return <div ref={mount} className="w-full h-full cursor-grab" />;
}
