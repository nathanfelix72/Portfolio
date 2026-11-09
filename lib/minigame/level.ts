import {
  type Poly,
  bounds,
  clonePoly,
  ensureCCW,
  pointInPoly,
  polyCenter,
  rectPoly,
  rotatePoly,
  translatePoly,
} from "./geom";
import { PLAYER_H, PLAYER_W } from "./physics";

/** Normalized polygon (verts in 0–1 of arena). */
export type LevelPlat = {
  verts: Array<{ x: number; y: number }>;
  /** When false, portals will not stick. Default true. */
  portalable?: boolean;
};

/** Player top-left in normalized arena coords (0–1). */
export type LevelSpawn = { x: number; y: number };

function nRect(
  x: number,
  y: number,
  w: number,
  h: number,
  portalable = true
): LevelPlat {
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

export const DEFAULT_LEVEL: LevelPlat[] = [
  nRect(0.02, 0.9, 0.96, 0.045),
  nRect(0.05, 0.72, 0.18, 0.035),
  nRect(0.28, 0.62, 0.12, 0.035),
  nRect(0.45, 0.52, 0.14, 0.035),
  nRect(0.64, 0.42, 0.12, 0.035),
  nRect(0.78, 0.3, 0.16, 0.035),
  nRect(0.38, 0.78, 0.08, 0.08, false),
  nRect(0.55, 0.7, 0.07, 0.12, false),
  nRect(0.12, 0.4, 0.1, 0.035),
  nRect(0.22, 0.28, 0.09, 0.09, false),
  nRect(0.7, 0.68, 0.14, 0.035),
  nRect(0.86, 0.55, 0.08, 0.2, false),
  nRect(0.3, 0.08, 0.4, 0.035),
];

/** Sensible default before first layout pass (refined via spawnOnFloor). */
export const DEFAULT_SPAWN: LevelSpawn = { x: 0.055, y: 0.82 };

export function cloneDefaultLevel(): LevelPlat[] {
  return DEFAULT_LEVEL.map((p) => ({
    portalable: p.portalable !== false,
    verts: p.verts.map((v) => ({ ...v })),
  }));
}

export function cloneDefaultSpawn(): LevelSpawn {
  return { ...DEFAULT_SPAWN };
}

export function layoutToPlatforms(
  layout: LevelPlat[],
  width: number,
  height: number
): Poly[] {
  return layout.map((p) => {
    const poly: Poly = {
      portalable: p.portalable !== false,
      verts: p.verts.map((v) => ({
        x: v.x * width,
        y: v.y * height,
      })),
    };
    ensureCCW(poly);
    return poly;
  });
}

export function platformsToLayout(
  platforms: Poly[],
  width: number,
  height: number
): LevelPlat[] {
  return platforms.map((p) => ({
    portalable: p.portalable !== false,
    verts: p.verts.map((v) => ({
      x: v.x / width,
      y: v.y / height,
    })),
  }));
}

export function spawnToPixels(
  spawn: LevelSpawn,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: spawn.x * width,
    y: spawn.y * height,
  };
}

export function pixelsToSpawn(
  x: number,
  y: number,
  width: number,
  height: number
): LevelSpawn {
  return {
    x: x / width,
    y: y / height,
  };
}

export function buildLevel(width: number, height: number): Poly[] {
  return layoutToPlatforms(DEFAULT_LEVEL, width, height);
}

export function spawnOnFloor(
  platforms: Poly[],
  playerW: number = PLAYER_W,
  playerH: number = PLAYER_H
): { x: number; y: number } {
  if (!platforms.length) return { x: 40, y: 40 };

  // Prefer the platform with the lowest top-ish support (largest max Y among verts that form a floor)
  let best: { x: number; y: number } | null = null;
  let bestSupportY = -Infinity;

  for (const plat of platforms) {
    const b = bounds(plat);
    if (b.y + b.h < bestSupportY) continue;
    // Stand near left of bbox top
    const x = b.x + Math.min(48, b.w * 0.08);
    const standY = b.y - playerH - 0.1;
    // Refine: cast down from above onto polygon by scanning
    let support = b.y;
    for (let s = 0; s < 24; s++) {
      const sy = b.y + (b.h * s) / 24;
      if (pointInPoly(plat, x + playerW / 2, sy)) {
        support = sy;
        break;
      }
    }
    // Use top of bbox as approximate floor for axis-aligned defaults
    support = b.y;
    if (support >= bestSupportY) {
      bestSupportY = support;
      best = {
        x: Math.min(x, b.x + Math.max(0, b.w - playerW - 8)),
        y: support - playerH - 0.1,
      };
    }
  }

  return best ?? { x: 40, y: 40 };
}

export function hitTestPlatform(platforms: Poly[], x: number, y: number): number {
  for (let i = platforms.length - 1; i >= 0; i--) {
    if (pointInPoly(platforms[i], x, y)) return i;
  }
  return -1;
}

export function hitTestSpawn(
  spawnPx: { x: number; y: number },
  x: number,
  y: number,
  pad = 18
): boolean {
  const cx = spawnPx.x + PLAYER_W / 2;
  const cy = spawnPx.y + PLAYER_H / 2;
  return Math.abs(x - cx) <= pad && Math.abs(y - cy) <= pad + 4;
}

export function addDefaultPlatform(width: number, height: number): Poly {
  return addRectPlatform(width, height);
}

export function addRectPlatform(width: number, height: number): Poly {
  const w = Math.max(80, width * 0.12);
  const h = Math.max(28, height * 0.045);
  const poly = rectPoly(width * 0.5 - w / 2, height * 0.45 - h / 2, w, h, true);
  ensureCCW(poly);
  return poly;
}

export function addSquarePlatform(width: number, height: number): Poly {
  const s = Math.max(56, Math.min(width, height) * 0.1);
  const poly = rectPoly(width * 0.5 - s / 2, height * 0.45 - s / 2, s, s, true);
  ensureCCW(poly);
  return poly;
}

export {
  clonePoly,
  polyCenter,
  rotatePoly,
  translatePoly,
  bounds,
};
