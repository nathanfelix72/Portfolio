export type Vec2 = { x: number; y: number };

export type Poly = {
  verts: Vec2[];
  /** When false, portals bounce / won't stick. Default true. */
  portalable?: boolean;
};

export function v(x: number, y: number): Vec2 {
  return { x, y };
}

export function isPortalable(p: Poly): boolean {
  return p.portalable !== false;
}

export function clonePoly(p: Poly): Poly {
  return {
    verts: p.verts.map((vert) => ({ ...vert })),
    portalable: p.portalable,
  };
}

export function rectPoly(
  x: number,
  y: number,
  w: number,
  h: number,
  portalable = true
): Poly {
  // CCW in screen space: TL → TR → BR → BL (outward normals point outside)
  return {
    portalable,
    verts: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}

export function polyCenter(p: Poly): Vec2 {
  let sx = 0;
  let sy = 0;
  for (const vert of p.verts) {
    sx += vert.x;
    sy += vert.y;
  }
  const n = p.verts.length || 1;
  return { x: sx / n, y: sy / n };
}

export function translatePoly(p: Poly, dx: number, dy: number): void {
  for (const vert of p.verts) {
    vert.x += dx;
    vert.y += dy;
  }
}

export function rotatePoly(p: Poly, angle: number, origin?: Vec2): void {
  const c = origin ?? polyCenter(p);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (const vert of p.verts) {
    const dx = vert.x - c.x;
    const dy = vert.y - c.y;
    vert.x = c.x + dx * cos - dy * sin;
    vert.y = c.y + dx * sin + dy * cos;
  }
}

export function bounds(p: Poly): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const vert of p.verts) {
    minX = Math.min(minX, vert.x);
    minY = Math.min(minY, vert.y);
    maxX = Math.max(maxX, vert.x);
    maxY = Math.max(maxY, vert.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function pointInPoly(p: Poly, x: number, y: number): boolean {
  // Ray cast odd/even
  let inside = false;
  const verts = p.verts;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x;
    const yi = verts[i].y;
    const xj = verts[j].x;
    const yj = verts[j].y;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Ensure CCW winding. */
export function ensureCCW(p: Poly): void {
  let area = 0;
  const verts = p.verts;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) verts.reverse();
}

/** Outward normal for edge i → i+1 (CCW poly). */
export function edgeOutward(p: Poly, i: number): Vec2 {
  const a = p.verts[i];
  const b = p.verts[(i + 1) % p.verts.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // CCW: outward is right of edge = (dy, -dx)
  return { x: dy / len, y: -dx / len };
}

/**
 * Normal that points out of the filled shape.
 * Crossed polygons (bowties) have edges whose winding normal points inward;
 * probe the fill and flip those so you stand on the silhouette instead of
 * falling through it.
 */
export function exteriorNormal(p: Poly, i: number): Vec2 {
  const a = p.verts[i];
  const b = p.verts[(i + 1) % p.verts.length];
  const n = edgeOutward(p, i);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const probe = 3;
  const aheadInside = pointInPoly(p, mx + n.x * probe, my + n.y * probe);
  const behindInside = pointInPoly(p, mx - n.x * probe, my - n.y * probe);
  if (aheadInside && !behindInside) {
    return { x: -n.x, y: -n.y };
  }
  if (aheadInside === behindInside && n.y > 0) {
    return { x: -n.x, y: -n.y };
  }
  return n;
}

export function edgeLength(p: Poly, i: number): number {
  const a = p.verts[i];
  const b = p.verts[(i + 1) % p.verts.length];
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function edgeTangent(p: Poly, i: number): Vec2 {
  const a = p.verts[i];
  const b = p.verts[(i + 1) % p.verts.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function project(verts: Vec2[], axisX: number, axisY: number) {
  let min = Infinity;
  let max = -Infinity;
  for (const vert of verts) {
    const d = vert.x * axisX + vert.y * axisY;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { min, max };
}

export type SatHit = {
  overlap: number;
  nx: number;
  ny: number;
};

/** SAT between two convex polys. Normal points from A → B (push B out of A). */
export function satConvex(a: Vec2[], b: Vec2[]): SatHit | null {
  let minOverlap = Infinity;
  let nx = 0;
  let ny = 0;

  const axes: Vec2[] = [];
  const collect = (verts: Vec2[]) => {
    for (let i = 0; i < verts.length; i++) {
      const p0 = verts[i];
      const p1 = verts[(i + 1) % verts.length];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      axes.push({ x: dy / len, y: -dx / len });
    }
  };
  collect(a);
  collect(b);

  const acx = a.reduce((s, p) => s + p.x, 0) / a.length;
  const acy = a.reduce((s, p) => s + p.y, 0) / a.length;
  const bcx = b.reduce((s, p) => s + p.x, 0) / b.length;
  const bcy = b.reduce((s, p) => s + p.y, 0) / b.length;

  for (const axis of axes) {
    const pa = project(a, axis.x, axis.y);
    const pb = project(b, axis.x, axis.y);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      // Orient normal from A toward B
      let ax = axis.x;
      let ay = axis.y;
      if ((bcx - acx) * ax + (bcy - acy) * ay < 0) {
        ax = -ax;
        ay = -ay;
      }
      nx = ax;
      ny = ay;
    }
  }

  return { overlap: minOverlap, nx, ny };
}

export function playerVerts(x: number, y: number, w: number, h: number): Vec2[] {
  return [
    { x, y },
    { x, y: y + h },
    { x: x + w, y: y + h },
    { x: x + w, y },
  ];
}

export type RayHit = {
  t: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  edgeIndex: number;
  edgeLen: number;
  poly: Poly;
};

export function raycastPolys(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  polys: Poly[],
  maxDist: number
): RayHit | null {
  const len = Math.hypot(dx, dy);
  if (len < 1e-8) return null;
  const rdx = dx / len;
  const rdy = dy / len;

  let best: RayHit | null = null;

  for (const poly of polys) {
    const verts = poly.verts;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const denom = rdx * ey - rdy * ex;
      if (Math.abs(denom) < 1e-10) continue;

      const t = ((a.x - ox) * ey - (a.y - oy) * ex) / denom;
      const u = ((a.x - ox) * rdy - (a.y - oy) * rdx) / denom;
      if (t <= 0.05 || t > maxDist || u < 0 || u > 1) continue;

      // Orient normal to face the shooter (robust if winding flips in the editor)
      const outward = edgeOutward(poly, i);
      let nx = outward.x;
      let ny = outward.y;
      if (rdx * nx + rdy * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      // Require approaching the face (ignore grazes / backsides)
      if (rdx * nx + rdy * ny > -0.02) continue;

      const hx = ox + rdx * t;
      const hy = oy + rdy * t;
      if (!best || t < best.t) {
        best = {
          t,
          x: hx,
          y: hy,
          nx,
          ny,
          edgeIndex: i,
          edgeLen: Math.hypot(ex, ey),
          poly,
        };
      }
    }
  }

  return best;
}

/** Insert a vertex at the midpoint of edge i. */
export function insertVertexOnEdge(p: Poly, edgeIndex: number): void {
  const a = p.verts[edgeIndex];
  const b = p.verts[(edgeIndex + 1) % p.verts.length];
  p.verts.splice(edgeIndex + 1, 0, {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
}

export function removeVertex(p: Poly, index: number): boolean {
  if (p.verts.length <= 3) return false;
  p.verts.splice(index, 1);
  return true;
}

export function nearestEdge(
  p: Poly,
  x: number,
  y: number
): { index: number; dist: number; px: number; py: number } {
  let best = { index: 0, dist: Infinity, px: x, py: y };
  for (let i = 0; i < p.verts.length; i++) {
    const a = p.verts[i];
    const b = p.verts[(i + 1) % p.verts.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((x - a.x) * abx + (y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const dist = Math.hypot(x - px, y - py);
    if (dist < best.dist) best = { index: i, dist, px, py };
  }
  return best;
}

export function nearestVertex(
  p: Poly,
  x: number,
  y: number,
  maxDist: number
): number {
  let best = -1;
  let bestD = maxDist;
  for (let i = 0; i < p.verts.length; i++) {
    const d = Math.hypot(p.verts[i].x - x, p.verts[i].y - y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Shortest push that moves an interior point back outside the filled shape. */
export function exteriorPushFromPoint(
  p: Poly,
  x: number,
  y: number
): { depth: number; nx: number; ny: number } | null {
  let bestDepth = Infinity;
  let nx = 0;
  let ny = 0;
  const verts = p.verts;

  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const n = exteriorNormal(p, i);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((x - a.x) * abx + (y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + abx * t;
    const qy = a.y + aby * t;
    const side = (x - qx) * n.x + (y - qy) * n.y;
    // Already outside this face.
    if (side > 1.5) continue;
    const depth = Math.hypot(x - qx, y - qy);
    if (depth < bestDepth) {
      bestDepth = depth;
      nx = n.x;
      ny = n.y;
    }
  }

  if (!Number.isFinite(bestDepth) || bestDepth === Infinity) return null;
  return { depth: bestDepth, nx, ny };
}

export type BoxResizeMode = "rect" | "square";

/**
 * Resize a 4-vertex quad by dragging one corner, keeping opposite corner fixed.
 * Uses the quad's current edge axes so rotation is preserved.
 */
export function resizeQuadCorner(
  snapshot: Poly,
  vertIndex: number,
  mouseX: number,
  mouseY: number,
  mode: BoxResizeMode
): Poly | null {
  if (snapshot.verts.length !== 4) return null;
  const opp = (vertIndex + 2) % 4;
  const anchor = snapshot.verts[opp];
  const adjA = snapshot.verts[(opp + 1) % 4];
  const adjB = snapshot.verts[(opp + 3) % 4];

  let ax = adjA.x - anchor.x;
  let ay = adjA.y - anchor.y;
  let bx = adjB.x - anchor.x;
  let by = adjB.y - anchor.y;
  const al = Math.hypot(ax, ay) || 1;
  const bl = Math.hypot(bx, by) || 1;
  ax /= al;
  ay /= al;
  bx /= bl;
  by /= bl;

  const dx = mouseX - anchor.x;
  const dy = mouseY - anchor.y;
  let wa = dx * ax + dy * ay;
  let wb = dx * bx + dy * by;

  if (mode === "square") {
    const s = Math.max(24, Math.max(Math.abs(wa), Math.abs(wb)));
    wa = Math.sign(wa || 1) * s;
    wb = Math.sign(wb || 1) * s;
  } else {
    wa = Math.sign(wa || 1) * Math.max(24, Math.abs(wa));
    wb = Math.sign(wb || 1) * Math.max(20, Math.abs(wb));
  }

  // Corners: anchor, along A, along A+B, along B — order depends on opp index
  const c0 = { x: anchor.x, y: anchor.y };
  const cA = { x: anchor.x + ax * wa, y: anchor.y + ay * wa };
  const cAB = {
    x: anchor.x + ax * wa + bx * wb,
    y: anchor.y + ay * wa + by * wb,
  };
  const cB = { x: anchor.x + bx * wb, y: anchor.y + by * wb };

  // Place verts so dragged corner is vertIndex and opposite stays opp
  const verts: Vec2[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  verts[opp] = c0;
  verts[(opp + 1) % 4] = cA;
  verts[vertIndex] = cAB;
  verts[(opp + 3) % 4] = cB;

  const poly: Poly = { verts, portalable: snapshot.portalable };
  ensureCCW(poly);
  return poly;
}
