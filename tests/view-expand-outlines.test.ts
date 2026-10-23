// The 3D view's Outlines only (each part's faces hide, its edges drawn; data and see-through parts kept readable), the
// 3D settings menu on every page's view, and the expand button on each chart.
import { test } from "vite-plus/test";
import assert from "node:assert";
import * as THREE from "three";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { outlineScene } from "../src/components/stack-view/outlineScene";
import { Viewer3DCard } from "../src/components/stack-view/Viewer3DCard";
import { ExpandableChart } from "../src/components/ui/ExpandPanel";
import { UI_TEXT } from "../src/constants/uiText";

/** The edge lines Outlines only added to a mesh. */
const edgesOf = (mesh: THREE.Mesh) => mesh.children.filter((c) => c instanceof THREE.LineSegments);

test("Outlines only: opaque parts write depth only, see-through parts hide, data and hole masks stay", () => {
  const box = () => new THREE.BoxGeometry(1, 1, 1);
  const opaque = new THREE.Mesh(box(), new THREE.MeshStandardMaterial());
  const ghost = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ transparent: true }));
  const data = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.DataTexture(new Uint8Array(4), 1, 1) }),
  );
  const holeMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
  const hole = new THREE.Mesh(box(), holeMaterial);
  const group = new THREE.Group();
  group.add(opaque, ghost, data, hole);
  outlineScene(group, 0x111111);

  // a box: its 12 edges drawn, its faces depth only, so they still hide the lines behind them
  assert.equal(edgesOf(opaque).length, 1);
  const lines = edgesOf(opaque)[0];
  assert.ok(lines instanceof THREE.LineSegments);
  assert.equal(lines.geometry.getAttribute("position").count, 24);
  assert.ok(!Array.isArray(opaque.material) && !opaque.material.colorWrite);
  assert.ok(!Array.isArray(opaque.material) && opaque.material.depthWrite);
  // see-through: fainter lines, and its faces draw nothing (not even depth)
  assert.equal(edgesOf(ghost).length, 1);
  assert.ok(!Array.isArray(ghost.material) && !ghost.material.visible);
  // the coverage floor's colors and a hole mask are untouched
  assert.equal(edgesOf(data).length, 0);
  assert.ok(data.material instanceof THREE.MeshBasicMaterial && data.material.map);
  assert.equal(edgesOf(hole).length, 0);
  assert.equal(hole.material, holeMaterial);
});

test("Outlines only: a curved part draws its outline, not each facet", () => {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 64),
    new THREE.MeshStandardMaterial(),
  );
  const group = new THREE.Group();
  group.add(cylinder);
  outlineScene(group, 0x111111);
  const lines = edgesOf(cylinder)[0];
  assert.ok(lines instanceof THREE.LineSegments);
  // the two rims (64 segments each), with no line down each of the 64 facets
  assert.equal(lines.geometry.getAttribute("position").count, 2 * 64 * 2);
});

test("the 3D view's card: one 3D settings menu, Reset 3D view, and Expand 3D view", () => {
  const html = renderToString(
    createElement(Viewer3DCard, { boxClassName: "", driversButton: true, children: () => null }),
  );
  for (const label of [UI_TEXT.settings3d, UI_TEXT.resetView, UI_TEXT.expand3dView])
    assert.ok(html.includes(`aria-label="${label}"`), label);
  assert.ok(html.includes('aria-haspopup="menu"'), "the settings button opens a menu");
  // the options are in the menu, not separate buttons
  for (const label of [UI_TEXT.cutaway, UI_TEXT.showDrivers])
    assert.ok(!html.includes(`aria-label="${label}"`), label);
});

test("a chart gets an Expand chart button, and the chart stays on the page", () => {
  const html = renderToString(
    createElement(ExpandableChart, { title: "Chart", children: createElement("svg") }),
  );
  assert.ok(html.includes(`aria-label="${UI_TEXT.expandChart}"`));
  assert.ok(html.includes("<svg"));
});
