/** Rounded rectangle outline centred on the origin, as a THREE.Shape. */
export function roundedRectShape(width, height, radius) {
  const x = width / 2, y = height / 2, shape = new THREE.Shape();
  const r = radius;
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y); shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
  return shape;
}

/** Rounded rectangle hole outline centred on (centerX, centerY), as a THREE.Path. */
export function roundedRectPath(centerX, centerY, width, height, radius) {
  const x = width / 2, y = height / 2, cx = centerX, cy = centerY, r = radius, path = new THREE.Path();
  path.moveTo(cx - x + r, cy - y);
  path.lineTo(cx + x - r, cy - y); path.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + r);
  path.lineTo(cx + x, cy + y - r); path.quadraticCurveTo(cx + x, cy + y, cx + x - r, cy + y);
  path.lineTo(cx - x + r, cy + y); path.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - r);
  path.lineTo(cx - x, cy - y + r); path.quadraticCurveTo(cx - x, cy - y, cx - x + r, cy - y);
  return path;
}

/** Circular hole outline centred on (centerX, centerY), as a THREE.Path. */
export function circlePath(centerX, centerY, radius) {
  const path = new THREE.Path();
  path.absarc(centerX, centerY, radius, 0, Math.PI * 2, true);
  return path;
}

/**
 * Adds an arch-topped outline to a THREE.Shape: flat bottom at `bottomY`, straight sides up to
 * `archCenterY`, then a semicircle of `radius` across the top.
 */
export function archOutlinePath(shape, halfWidth, bottomY, archCenterY, radius) {
  shape.moveTo(-halfWidth, bottomY); shape.lineTo(halfWidth, bottomY); shape.lineTo(halfWidth, archCenterY);
  shape.absarc(0, archCenterY, radius, 0, Math.PI, false); shape.lineTo(-halfWidth, bottomY);
  return shape;
}

/**
 * Rectangular horn flare as a mesh geometry: a circular throat of `throatRadius` growing along z over
 * `depth` into a superellipse that squares up toward a `mouthWidth` by `mouthHeight` mouth.
 */
export function rectangularHornGeometry(mouthWidth, mouthHeight, depth, throatRadius = 0.5) {
  const NS = 40, NP = 112, pos = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS, g = Math.pow(t, 1.7);
    const a = throatRadius + (mouthWidth / 2 - throatRadius) * g, b = throatRadius + (mouthHeight / 2 - throatRadius) * g;
    const n = 2 + 7 * Math.pow(t, 1.4);          // superellipse exponent: circle -> squarish
    for (let j = 0; j < NP; j++) {
      const th = (j / NP) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      pos.push(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
               b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), depth * t);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) {
    const a0 = i * NP + j, a1 = i * NP + ((j + 1) % NP);
    idx.push(a0, a0 + NP, a1, a1, a0 + NP, a1 + NP);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/** Pictogram silhouette of a person, billboarded and semi-transparent, `heightIn` inches tall (standing on y = 0). */
export function createScaleFigure(heightIn) {
  const u = heightIn / 100;
  const figure = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0x8b847d, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
  const body = new THREE.Shape();
  const outline = [
    [6.5, 85], [10.0, 82], [11.0, 70], [8.0, 50], [6.5, 30], [5.5, 1],
    [1.0, 1], [0, 40], [-1.0, 1], [-5.5, 1], [-6.5, 30], [-8.0, 50],
    [-11.0, 70], [-10.0, 82], [-6.5, 85],
  ];
  body.moveTo(outline[0][0] * u, outline[0][1] * u);
  outline.slice(1).forEach(([x, y]) => body.lineTo(x * u, y * u));
  body.closePath();
  figure.add(new THREE.Mesh(new THREE.ShapeGeometry(body), material));
  const head = new THREE.Shape();
  head.absarc(0, 92.5 * u, 6 * u, 0, Math.PI * 2, false);
  figure.add(new THREE.Mesh(new THREE.ShapeGeometry(head), material));
  return figure;
}
