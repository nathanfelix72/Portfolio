import type { Poly } from "./geom";
import { isPortalable, polyCenter } from "./geom";
import type { AimHit, Player, Portal } from "./physics";
import {
  GUN_REACH,
  PLAYER_H,
  PLAYER_W,
  PORTAL_THICKNESS,
  SHOULDER_OFFSET_Y,
  gunMuzzle,
} from "./physics";

const INK = "#10231f";
const TEAL = "#0f766e";
const ORANGE = "#c45c26";
const PAPER = "rgba(247, 250, 247, 0.92)";
const PLAT_FILL = "rgba(16, 35, 31, 0.78)";
const PLAT_EDGE = "rgba(15, 118, 110, 0.55)";
const SOLID_FILL = "rgba(92, 78, 70, 0.88)";
const SOLID_EDGE = "rgba(74, 60, 52, 0.7)";
const SOLID_SELECTED = "rgba(120, 96, 82, 0.95)";

export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
}

export function drawArenaBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#f7faf7");
  g.addColorStop(0.55, "#f3f6f2");
  g.addColorStop(1, "#e4ebe5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(15, 118, 110, 0.1)";
  ctx.beginPath();
  ctx.arc(width * 0.15, height * 0.1, width * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(16, 35, 31, 0.05)";
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.2, width * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pathPoly(ctx: CanvasRenderingContext2D, p: Poly) {
  const verts = p.verts;
  if (!verts.length) return;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();
}

export function drawPlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: Poly[],
  selectedIndex = -1,
  options?: {
    showHandles?: boolean;
    showEdgeDots?: boolean;
    rotateHandle?: { x: number; y: number };
  }
) {
  ctx.save();
  platforms.forEach((p, i) => {
    const selected = i === selectedIndex;
    const portalable = isPortalable(p);
    if (portalable) {
      ctx.fillStyle = selected ? "rgba(15, 118, 110, 0.88)" : PLAT_FILL;
      ctx.strokeStyle = selected ? TEAL : PLAT_EDGE;
    } else {
      ctx.fillStyle = selected ? SOLID_SELECTED : SOLID_FILL;
      ctx.strokeStyle = selected ? ORANGE : SOLID_EDGE;
    }
    pathPoly(ctx, p);
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 2;
    pathPoly(ctx, p);
    ctx.stroke();

    // Hatch non-portalable surfaces so they read as "metal"
    if (!portalable) {
      ctx.save();
      pathPoly(ctx, p);
      ctx.clip();
      ctx.strokeStyle = "rgba(40, 32, 28, 0.28)";
      ctx.lineWidth = 1;
      const b = p.verts.reduce(
        (acc, v) => ({
          minX: Math.min(acc.minX, v.x),
          minY: Math.min(acc.minY, v.y),
          maxX: Math.max(acc.maxX, v.x),
          maxY: Math.max(acc.maxY, v.y),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
      for (let x = b.minX - (b.maxY - b.minY); x < b.maxX + 40; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, b.minY);
        ctx.lineTo(x + (b.maxY - b.minY), b.maxY);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (selected && options?.showHandles) {
      const hs = 8;
      ctx.fillStyle = "#f7faf7";
      for (const vert of p.verts) {
        ctx.beginPath();
        ctx.rect(vert.x - hs / 2, vert.y - hs / 2, hs, hs);
        ctx.fill();
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (options.showEdgeDots !== false) {
        ctx.fillStyle = "rgba(15, 118, 110, 0.55)";
        for (let ei = 0; ei < p.verts.length; ei++) {
          const a = p.verts[ei];
          const b = p.verts[(ei + 1) % p.verts.length];
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (options.rotateHandle) {
        const c = polyCenter(p);
        const rh = options.rotateHandle;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(rh.x, rh.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ORANGE;
        ctx.beginPath();
        ctx.arc(rh.x, rh.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  });
  ctx.restore();
}

export function drawEditorHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  reshapeMode: "free" | "rect" | "square" = "free"
) {
  ctx.save();
  ctx.font = '500 13px var(--font-body, "Segoe UI", sans-serif)';
  ctx.fillStyle = "rgba(16, 35, 31, 0.72)";
  const modeHint =
    reshapeMode === "free"
      ? "Drag spawn · teal = portals stick · brown hatch = solid · free corners · orange rotates"
      : reshapeMode === "square"
        ? "Drag spawn · square resize · opposite corner fixed · orange rotates"
        : "Drag spawn · rect resize · opposite corner fixed · orange rotates";
  ctx.fillText(modeHint, 16, 28);
  ctx.fillStyle = "rgba(15, 118, 110, 0.85)";
  ctx.fillText("Editing", width - 70, 28);
  ctx.restore();
}

/** Ghost stick figure + ring marking the playable start point. */
export function drawSpawnMarker(
  ctx: CanvasRenderingContext2D,
  spawn: { x: number; y: number },
  selected = false
) {
  const cx = spawn.x + PLAYER_W / 2;
  const cy = spawn.y + PLAYER_H / 2;

  ctx.save();
  ctx.strokeStyle = selected ? ORANGE : TEAL;
  ctx.fillStyle = selected
    ? "rgba(196, 92, 38, 0.18)"
    : "rgba(15, 118, 110, 0.14)";
  ctx.lineWidth = selected ? 2.5 : 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, PLAYER_W * 0.85, PLAYER_H * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Mini stick figure
  const hx = cx;
  const hy = spawn.y + 10;
  ctx.strokeStyle = selected ? ORANGE : INK;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(hx, hy, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hx, hy + 5);
  ctx.lineTo(hx, hy + 22);
  ctx.moveTo(hx - 8, hy + 12);
  ctx.lineTo(hx + 8, hy + 12);
  ctx.moveTo(hx, hy + 22);
  ctx.lineTo(hx - 7, hy + 34);
  ctx.moveTo(hx, hy + 22);
  ctx.lineTo(hx + 7, hy + 34);
  ctx.stroke();

  ctx.font = '600 11px var(--font-body, "Segoe UI", sans-serif)';
  ctx.fillStyle = selected ? ORANGE : TEAL;
  ctx.fillText("Start", cx - 14, spawn.y - 6);
  ctx.restore();
}

export function drawAim(
  ctx: CanvasRenderingContext2D,
  player: Player,
  mouseX: number,
  mouseY: number,
  hit: AimHit | null
) {
  const muzzle = gunMuzzle(player, mouseX, mouseY);
  const endX = hit ? hit.x : mouseX;
  const endY = hit ? hit.y : mouseY;
  const canPortal = hit ? isPortalable(hit.poly) : false;

  ctx.save();
  ctx.strokeStyle = hit
    ? canPortal
      ? "rgba(15, 118, 110, 0.55)"
      : "rgba(196, 92, 38, 0.45)"
    : "rgba(16, 35, 31, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(muzzle.x, muzzle.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (hit) {
    ctx.fillStyle = canPortal
      ? "rgba(15, 118, 110, 0.85)"
      : "rgba(196, 92, 38, 0.85)";
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (!canPortal) {
      // X mark — surface rejects portals
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hit.x - 5, hit.y - 5);
      ctx.lineTo(hit.x + 5, hit.y + 5);
      ctx.moveTo(hit.x + 5, hit.y - 5);
      ctx.lineTo(hit.x - 5, hit.y + 5);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "rgba(16, 35, 31, 0.35)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  player: Player,
  aimX: number,
  aimY: number
) {
  const { x, y, w, h, onGround, vx } = player;
  const cx = x + w / 2;
  const headR = 5.5;
  const headY = y + headR + 1;
  const neckY = headY + headR;
  const hipY = y + h * 0.62;
  const footY = y + h;
  const shoulderY = y + SHOULDER_OFFSET_Y;

  const walk = onGround
    ? Math.sin(performance.now() / 90) * Math.min(1, Math.abs(vx) / 180)
    : 0;
  const legSwing = walk * 7;

  const dx = aimX - cx;
  const dy = aimY - shoulderY;
  const ang = Math.atan2(dy, dx);
  const armLen = GUN_REACH * 0.5;
  const handX = cx + Math.cos(ang) * armLen;
  const handY = shoulderY + Math.sin(ang) * armLen;
  const muzzleX = cx + Math.cos(ang) * GUN_REACH;
  const muzzleY = shoulderY + Math.sin(ang) * GUN_REACH;

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, neckY);
  ctx.lineTo(cx, hipY);
  ctx.stroke();

  const idleSide = aimX >= cx ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(cx, shoulderY);
  ctx.lineTo(cx + idleSide * 8, shoulderY + 5 + walk * 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, shoulderY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(muzzleX, muzzleY);
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx - 6 - legSwing, footY);
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx + 6 + legSwing, footY);
  ctx.stroke();

  ctx.restore();
}

function portalColor(portal: Portal) {
  return portal.color === "blue" ? TEAL : ORANGE;
}

export function drawPortal(ctx: CanvasRenderingContext2D, portal: Portal) {
  const half = portal.length / 2;
  const t = PORTAL_THICKNESS;
  const color = portalColor(portal);
  const ang = Math.atan2(portal.ty, portal.tx);

  ctx.save();
  ctx.translate(portal.x, portal.y);
  ctx.rotate(ang);

  // Thickness should sit in free space (outward normal side).
  const localNy =
    -portal.nx * Math.sin(ang) + portal.ny * Math.cos(ang);
  const oy = localNy >= 0 ? 0 : -t;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.22;
  roundRect(ctx, -half - 3, oy - 3, portal.length + 6, t + 6, 8);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  roundRect(ctx, -half, oy, portal.length, t, 7);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.ellipse(0, oy + t / 2, half * 0.72, t * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawHud(ctx: CanvasRenderingContext2D, width: number) {
  ctx.save();
  ctx.font = '500 13px var(--font-body, "Segoe UI", sans-serif)';
  ctx.fillStyle = "rgba(16, 35, 31, 0.7)";
  ctx.fillText(
    "WASD / arrows · Space jump · LMB teal · RMB orange · Esc home",
    16,
    28
  );

  ctx.fillStyle = TEAL;
  ctx.fillRect(width - 120, 14, 14, 14);
  ctx.fillStyle = "rgba(16, 35, 31, 0.7)";
  ctx.fillText("LMB", width - 100, 26);

  ctx.fillStyle = ORANGE;
  ctx.fillRect(width - 60, 14, 14, 14);
  ctx.fillStyle = "rgba(16, 35, 31, 0.7)";
  ctx.fillText("RMB", width - 40, 26);
  ctx.restore();
}
