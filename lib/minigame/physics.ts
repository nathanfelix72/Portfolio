import {
  type Poly,
  type RayHit,
  type Vec2,
  bounds,
  edgeOutward,
  exteriorNormal,
  exteriorPushFromPoint,
  isPortalable,
  pointInPoly,
  raycastPolys,
} from "./geom";

export type { Poly, Vec2 } from "./geom";
export type Rect = { x: number; y: number; w: number; h: number };
export type PortalColor = "blue" | "orange";

export type Portal = {
  color: PortalColor;
  x: number;
  y: number;
  length: number;
  nx: number;
  ny: number;
  tx: number;
  ty: number;
};

export type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  /** Preserve portal launch momentum while > 0 (seconds). */
  portalFlight: number;
  /** Skip solid resolution briefly after teleport so exits aren't eaten. */
  collisionGrace: number;
  /** Outward normal of the surface we're standing on. */
  groundNx: number;
  groundNy: number;
};

export type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
};

export type AimHit = RayHit;

export const PLAYER_W = 18;
export const PLAYER_H = 36;
export const MOVE_SPEED = 240;
export const AIR_STEER_ON_LAUNCH = 140;
export const JUMP_VELOCITY = -460;
export const GRAVITY = 1500;
export const MAX_FALL = 980;
export const PORTAL_LENGTH = 52;
export const PORTAL_THICKNESS = 14;
export const PORTAL_COLLISION_GRACE = 0.08;
/** Soft cap so portal exits stay snappy without tunneling into floors. */
export const MAX_PORTAL_SPEED = 1500;
export const GUN_REACH = 24;
export const SHOULDER_OFFSET_Y = 14;

const EPS = 0.05;

export function createPlayer(spawnX: number, spawnY: number): Player {
  return {
    x: spawnX,
    y: spawnY,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    portalFlight: 0,
    collisionGrace: 0,
    groundNx: 0,
    groundNy: -1,
  };
}

export function playerCenter(player: Player) {
  return { x: player.x + player.w / 2, y: player.y + player.h / 2 };
}

export function gunMuzzle(player: Player, aimX: number, aimY: number) {
  const cx = player.x + player.w / 2;
  const shoulderY = player.y + SHOULDER_OFFSET_Y;
  const dx = aimX - cx;
  const dy = aimY - shoulderY;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: cx + (dx / len) * GUN_REACH,
    y: shoulderY + (dy / len) * GUN_REACH,
    dx: dx / len,
    dy: dy / len,
    shoulderX: cx,
    shoulderY,
  };
}

export function stepPlayer(
  player: Player,
  input: InputState,
  platforms: Poly[],
  dt: number,
  aimX: number
) {
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (player.collisionGrace > 0) {
    player.collisionGrace = Math.max(0, player.collisionGrace - dt);
  }

  // Portal launches keep their speed until something is actually landed on.
  const launched = player.portalFlight > 0;

  if (player.onGround && !launched) {
    // Slide along the ground so slopes don't fight horizontal walk speed.
    const speed = move * MOVE_SPEED;
    let tx = -player.groundNy;
    let ty = player.groundNx;
    if (tx < 0) {
      tx = -tx;
      ty = -ty;
    }
    if (Math.hypot(tx, ty) < 0.2) {
      tx = 1;
      ty = 0;
    }
    player.vx = tx * speed;
    player.vy = ty * speed;
  } else if (launched) {
    // Mild air steer — enough to walk out of a floor↔floor bounce if held.
    if (move !== 0) player.vx += move * AIR_STEER_ON_LAUNCH * dt;
  } else if (move !== 0) {
    player.vx = move * MOVE_SPEED;
  } else {
    player.vx = 0;
  }

  if (Math.abs(aimX - (player.x + player.w / 2)) > 4) {
    player.facing = aimX >= player.x + player.w / 2 ? 1 : -1;
  } else if (move !== 0) {
    player.facing = move > 0 ? 1 : -1;
  }

  let jumped = false;
  if (input.jump && player.onGround && !launched) {
    // Pop off the surface along its normal so the ramp doesn't eat the jump.
    player.x += player.groundNx * 4;
    player.y += player.groundNy * 4;
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    player.groundNx = 0;
    player.groundNy = -1;
    jumped = true;
  }

  if (!jumped) {
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
  } else {
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt * 0.5);
  }

  // Fast portal exits can cover more than a platform thickness in one frame.
  const travel = Math.hypot(player.vx, player.vy) * dt;
  const steps = Math.min(8, Math.max(1, Math.ceil(travel / 10)));
  const sdt = dt / steps;

  let wasGrounded = player.onGround;
  for (let step = 0; step < steps; step++) {
    const prevY = player.y;
    player.x += player.vx * sdt;
    player.y += player.vy * sdt;
    player.onGround = false;
    if (player.collisionGrace <= 0) {
      resolvePolygons(player, platforms, prevY, wasGrounded, jumped);
    } else {
      // Still unstick if grace left us buried in a solid.
      unstickIfBuried(player, platforms);
    }
    wasGrounded = player.onGround || wasGrounded;
    if (player.onGround) jumped = false;
  }
}

function resolvePolygons(
  player: Player,
  platforms: Poly[],
  prevY: number,
  wasGrounded: boolean,
  jumped: boolean
) {
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const plat of platforms) {
      if (separateFromPoly(player, plat)) moved = true;
    }
    if (!moved) break;
  }

  if (!jumped) {
    for (const plat of platforms) {
      if (landOnPoly(player, plat, prevY, wasGrounded)) break;
    }
  }

  // Final pass — high-speed hits can still leave a foot inside after landing.
  unstickIfBuried(player, platforms);
}

/** Emergency separation when the body is clearly inside a solid. */
function unstickIfBuried(player: Player, platforms: Poly[]) {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const plat of platforms) {
      if (separateFromPoly(player, plat, true)) moved = true;
    }
    if (!moved) break;
  }
}

/** Push the body out of a solid without treating a jump or portal launch as a landing. */
function separateFromPoly(
  player: Player,
  plat: Poly,
  forceFull = false
): boolean {
  const b = bounds(plat);
  if (
    player.x + player.w < b.x - 4 ||
    player.x > b.x + b.w + 4 ||
    player.y + player.h < b.y - 4 ||
    player.y > b.y + b.h + 4
  ) {
    return false;
  }

  const samples = [
    { x: player.x + player.w / 2, y: player.y + player.h * 0.45 },
    { x: player.x + 3, y: player.y + player.h * 0.7 },
    { x: player.x + player.w - 3, y: player.y + player.h * 0.7 },
    { x: player.x + player.w / 2, y: player.y + 4 },
    // Feet — critical after fast portal landings that bury the legs.
    { x: player.x + player.w / 2, y: player.y + player.h - 2 },
    { x: player.x + 3, y: player.y + player.h - 2 },
    { x: player.x + player.w - 3, y: player.y + player.h - 2 },
  ];

  let best: { depth: number; nx: number; ny: number } | null = null;
  for (const s of samples) {
    if (!pointInPoly(plat, s.x, s.y)) continue;
    const push = exteriorPushFromPoint(plat, s.x, s.y);
    if (!push) continue;
    if (!best || push.depth < best.depth) best = push;
  }
  if (!best || best.depth < 0.4) return false;

  const away = player.vx * best.nx + player.vy * best.ny;
  const launching = !forceFull && player.portalFlight > 0 && away > 30;
  const jumpingOff = !forceFull && player.vy < -120 && best.ny < -0.2;

  // Soft launch push only for shallow grazes — deep embeds always eject fully.
  if ((launching || jumpingOff) && best.depth <= 8) {
    return false;
  }

  player.x += best.nx * (best.depth + EPS);
  player.y += best.ny * (best.depth + EPS);
  if (away < 0) {
    player.vx -= best.nx * away;
    player.vy -= best.ny * away;
  }
  // Hitting a floor hard ends portal flight so landing/walk resume cleanly.
  if (best.ny < -0.4 && best.depth > 2) {
    player.portalFlight = 0;
    if (player.vy > 0) player.vy = 0;
  }
  return true;
}

/** Stand on the real top edge under the feet, including slopes. */
function landOnPoly(
  player: Player,
  plat: Poly,
  prevY: number,
  wasGrounded: boolean
): boolean {
  // Rising jump — don't glue back onto the ramp.
  if (player.vy < -80) return false;

  const b = bounds(plat);
  if (
    player.x + player.w < b.x - 6 ||
    player.x > b.x + b.w + 6 ||
    player.y > b.y + b.h + 8 ||
    player.y + player.h < b.y - 24
  ) {
    return false;
  }

  const footXs = [
    player.x + 4,
    player.x + player.w / 2,
    player.x + player.w - 4,
  ];
  const prevFootY = prevY + player.h;
  const footY = player.y + player.h;
  const reach = wasGrounded ? 14 : 12;
  // After a fast portal slam the feet can already be deep inside the platform.
  const buryLimit = Math.min(b.h + 8, player.h + 16);

  let best: { y: number; nx: number; ny: number; dx: number } | null = null;

  for (let i = 0; i < plat.verts.length; i++) {
    const n = exteriorNormal(plat, i);
    if (n.y > -0.28) continue;

    const a = plat.verts[i];
    const c = plat.verts[(i + 1) % plat.verts.length];
    if (Math.abs(c.x - a.x) < 0.75) continue;

    for (const fx of footXs) {
      const t = (fx - a.x) / (c.x - a.x);
      if (t < -0.02 || t > 1.02) continue;
      const y = a.y + t * (c.y - a.y);
      const crossed = prevFootY <= y + 2 && footY >= y - 2;
      const near = footY <= y + 2 && y - footY <= reach && player.vy >= -20;
      const buried =
        footY > y - 2 &&
        footY - y <= buryLimit &&
        player.vy >= -40 &&
        (pointInPoly(plat, fx, Math.min(footY - 1, y + buryLimit * 0.5)) ||
          pointInPoly(plat, fx, footY - 1));
      if (!crossed && !near && !buried) continue;

      const dx = Math.abs(fx - (player.x + player.w / 2));
      if (!best || y < best.y - 0.5 || (Math.abs(y - best.y) < 0.5 && dx < best.dx)) {
        best = { y, nx: n.x, ny: n.y, dx };
      }
    }
  }

  if (!best) return false;

  player.y = best.y - player.h - EPS;
  // Keep horizontal placement; only remove velocity into the floor.
  const into = player.vx * best.nx + player.vy * best.ny;
  if (into < 0) {
    player.vx -= best.nx * into;
    player.vy -= best.ny * into;
  }
  if (player.vy > 0) player.vy = 0;
  player.onGround = true;
  player.groundNx = best.nx;
  player.groundNy = best.ny;
  player.portalFlight = 0;
  return true;
}

export function aimAt(
  player: Player,
  aimX: number,
  aimY: number,
  platforms: Poly[]
): { muzzle: ReturnType<typeof gunMuzzle>; hit: AimHit | null } {
  const muzzle = gunMuzzle(player, aimX, aimY);
  let hit = raycastPolys(
    muzzle.shoulderX,
    muzzle.shoulderY,
    muzzle.dx,
    muzzle.dy,
    platforms,
    4000
  );

  // Underfoot fallback while standing on a mostly flat top
  if (!hit && muzzle.dy > 0.55 && player.onGround) {
    const cx = player.x + player.w / 2;
    const feetY = player.y + player.h + 2;
    for (const plat of platforms) {
      if (!pointInPoly(plat, cx, feetY) && !pointInPoly(plat, cx, feetY - 8)) {
        // also accept if feet near any upward-facing edge
        let near = false;
        for (let i = 0; i < plat.verts.length; i++) {
          const n = edgeOutward(plat, i);
          if (n.y > -0.7) continue;
          const a = plat.verts[i];
          const b = plat.verts[(i + 1) % plat.verts.length];
          const midY = (a.y + b.y) / 2;
          if (Math.abs(midY - (player.y + player.h)) > 8) continue;
          const minX = Math.min(a.x, b.x);
          const maxX = Math.max(a.x, b.x);
          if (cx < minX - 4 || cx > maxX + 4) continue;
          hit = {
            t: 10,
            x: cx,
            y: midY,
            nx: n.x,
            ny: n.y,
            edgeIndex: i,
            edgeLen: Math.hypot(b.x - a.x, b.y - a.y),
            poly: plat,
          };
          near = true;
          break;
        }
        if (near) break;
        continue;
      }

      // Standing in/on poly — find closest upward edge
      let bestI = -1;
      let bestY = Infinity;
      for (let i = 0; i < plat.verts.length; i++) {
        const n = edgeOutward(plat, i);
        if (n.y > -0.7) continue;
        const a = plat.verts[i];
        const b = plat.verts[(i + 1) % plat.verts.length];
        const midY = (a.y + b.y) / 2;
        if (midY < bestY) {
          bestY = midY;
          bestI = i;
        }
      }
      if (bestI >= 0) {
        const n = edgeOutward(plat, bestI);
        const a = plat.verts[bestI];
        const b = plat.verts[(bestI + 1) % plat.verts.length];
        hit = {
          t: 10,
          x: cx,
          y: (a.y + b.y) / 2,
          nx: n.x,
          ny: n.y,
          edgeIndex: bestI,
          edgeLen: Math.hypot(b.x - a.x, b.y - a.y),
          poly: plat,
        };
        break;
      }
    }
  }

  return { muzzle, hit };
}

function clampPortalOnEdge(hit: AimHit, length: number): { x: number; y: number; length: number } {
  const half = length / 2;
  const margin = 3;
  const a = hit.poly.verts[hit.edgeIndex];
  const b = hit.poly.verts[(hit.edgeIndex + 1) % hit.poly.verts.length];
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const edgeLen = Math.hypot(ex, ey) || 1;
  const usable = Math.max(16, edgeLen - margin * 2);
  const portalLen = Math.min(length, usable);
  const th = portalLen / 2;

  // Project hit onto edge parameter 0..1
  let t = ((hit.x - a.x) * ex + (hit.y - a.y) * ey) / (edgeLen * edgeLen);
  const minT = (th + margin) / edgeLen;
  const maxT = 1 - (th + margin) / edgeLen;
  if (maxT >= minT) t = Math.min(maxT, Math.max(minT, t));
  else t = 0.5;

  return {
    x: a.x + ex * t,
    y: a.y + ey * t,
    length: portalLen,
  };
}

export function tryPlacePortal(
  player: Player,
  targetX: number,
  targetY: number,
  color: PortalColor,
  platforms: Poly[],
  existing: { blue: Portal | null; orange: Portal | null }
): { blue: Portal | null; orange: Portal | null } {
  const { hit } = aimAt(player, targetX, targetY, platforms);
  if (!hit || hit.edgeLen < 20 || !isPortalable(hit.poly)) return existing;

  const placed = clampPortalOnEdge(hit, PORTAL_LENGTH);
  // Tangent from normal only — edge winding order was flipping left/right
  const tx = -hit.ny;
  const ty = hit.nx;

  const portal: Portal = {
    color,
    x: placed.x,
    y: placed.y,
    length: placed.length,
    nx: hit.nx,
    ny: hit.ny,
    tx,
    ty,
  };

  if (color === "blue") return { blue: portal, orange: existing.orange };
  return { blue: existing.blue, orange: portal };
}

function portalSensor(portal: Portal): {
  x: number;
  y: number;
  w: number;
  h: number;
  verts: Vec2[];
} {
  const half = portal.length / 2;
  // Reach into free space (along outward normal) so the player can enter
  const depth = portal.ny < -0.55 ? 30 : PORTAL_THICKNESS + 10;
  const hx = portal.tx * half;
  const hy = portal.ty * half;
  const ox = portal.nx * depth;
  const oy = portal.ny * depth;
  // On the surface ± tangent, then out into open space
  const verts = [
    { x: portal.x - hx, y: portal.y - hy },
    { x: portal.x + hx, y: portal.y + hy },
    { x: portal.x + hx + ox, y: portal.y + hy + oy },
    { x: portal.x - hx + ox, y: portal.y - hy + oy },
  ];
  const b = bounds({ verts });
  return { ...b, verts };
}

function pointInSensor(
  sensor: ReturnType<typeof portalSensor>,
  player: Player
): boolean {
  const poly = { verts: sensor.verts };
  const samples = [
    { x: player.x + player.w / 2, y: player.y + player.h / 2 },
    { x: player.x + player.w / 2, y: player.y + player.h - 2 },
    { x: player.x + 2, y: player.y + player.h - 2 },
    { x: player.x + player.w - 2, y: player.y + player.h - 2 },
    { x: player.x + player.w / 2, y: player.y + player.h * 0.7 },
  ];
  return samples.some((s) => pointInPoly(poly, s.x, s.y));
}

function exitPosition(
  entry: Portal,
  exit: Portal,
  player: Player
): { x: number; y: number } {
  const slope = 1 - Math.abs(exit.ny);
  const gap = 28 + slope * 18;
  let ox = 0;
  let oy = 0;

  // Carry lateral offset only while steering — idle bounces stay centered.
  if (Math.abs(player.vx) >= 40) {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    const fromTx = -entry.ny;
    const fromTy = entry.nx;
    const along = (cx - entry.x) * fromTx + (cy - entry.y) * fromTy;
    let tx = -exit.ny;
    let ty = exit.nx;
    if (fromTx * tx + fromTy * ty < 0) {
      tx = -tx;
      ty = -ty;
    }
    ox = tx * along;
    oy = ty * along;
  }

  return {
    x: exit.x + exit.nx * gap + ox - player.w / 2,
    y: exit.y + exit.ny * gap + oy - player.h / 2,
  };
}

/**
 * Portal momentum: decompose into entry normal/tangent, rebuild on exit.
 * Exit tangent is sign-aligned with entry tangent so floor↔ceiling (and other
 * opposite faces) don't reverse left/right.
 */
function remapVelocity(
  vx: number,
  vy: number,
  from: Portal,
  to: Portal,
  intoSpeed: number,
  dropTangent: boolean
): { vx: number; vy: number } {
  // Valve-style: speed through the entry becomes speed out the exit normal.
  // Speed across the entry surface is kept across the exit surface.
  const fromTx = -from.ny;
  const fromTy = from.nx;
  let toTx = -to.ny;
  let toTy = to.nx;
  if (fromTx * toTx + fromTy * toTy < 0) {
    toTx = -toTx;
    toTy = -toTy;
  }

  const vNormal = Math.max(-(vx * from.nx + vy * from.ny), intoSpeed);
  const vTangent = dropTangent ? 0 : vx * fromTx + vy * fromTy;

  return {
    vx: to.nx * vNormal + toTx * vTangent,
    vy: to.ny * vNormal + toTy * vTangent,
  };
}

export function tryTeleport(
  player: Player,
  portals: { blue: Portal | null; orange: Portal | null }
): boolean {
  if (!portals.blue || !portals.orange) return false;

  const blueSensor = portalSensor(portals.blue);
  const orangeSensor = portalSensor(portals.orange);

  let entry: Portal | null = null;
  let exit: Portal | null = null;

  if (pointInSensor(blueSensor, player)) {
    entry = portals.blue;
    exit = portals.orange;
  } else if (pointInSensor(orangeSensor, player)) {
    entry = portals.orange;
    exit = portals.blue;
  }

  if (!entry || !exit) return false;

  const realInto = player.vx * -entry.nx + player.vy * -entry.ny;
  let into = realInto;

  // Floor walk-in / stand-in only when grounded or actually falling into the portal.
  // (Moving out along the normal has realInto < 0 — must NOT force a re-teleport,
  // or floor↔floor exits instantly bounce you back while still in the exit volume.)
  const floorPortal = entry.ny < -0.35;
  const fallingIn = realInto > 20;
  const walkOnto = floorPortal && player.onGround;
  if (walkOnto) into = Math.max(realInto, 220);
  else if (floorPortal && fallingIn && realInto < 140) {
    into = Math.max(realInto, 180);
  }

  if (into < 30) return false;

  // Idle floor bounces drop tangent (straight out); held left/right keeps it.
  const flat = Math.abs(entry.nx) < 0.22;
  const dropTangent = flat && Math.abs(player.vx) < 40;

  const pos = exitPosition(entry, exit, player);
  const vel = remapVelocity(player.vx, player.vy, entry, exit, into, dropTangent);
  const speed = Math.hypot(vel.vx, vel.vy);
  if (speed > MAX_PORTAL_SPEED) {
    const s = MAX_PORTAL_SPEED / speed;
    vel.vx *= s;
    vel.vy *= s;
  }

  player.x = pos.x;
  player.y = pos.y;
  player.vx = vel.vx;
  player.vy = vel.vy;
  player.onGround = false;
  player.groundNx = 0;
  player.groundNy = -1;
  player.portalFlight = 1;
  player.collisionGrace = PORTAL_COLLISION_GRACE;
  return true;
}
