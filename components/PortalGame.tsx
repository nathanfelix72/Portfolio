"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  insertVertexOnEdge,
  nearestEdge,
  nearestVertex,
  polyCenter,
  removeVertex,
  resizeQuadCorner,
  rotatePoly,
  type Poly,
} from "@/lib/minigame/geom";
import {
  clearCanvas,
  drawAim,
  drawArenaBackground,
  drawEditorHud,
  drawHud,
  drawPlatforms,
  drawPortal,
  drawSpawnMarker,
  drawStickFigure,
} from "@/lib/minigame/draw";
import {
  addRectPlatform,
  addSquarePlatform,
  cloneDefaultLevel,
  cloneDefaultSpawn,
  hitTestPlatform,
  hitTestSpawn,
  layoutToPlatforms,
  pixelsToSpawn,
  platformsToLayout,
  spawnOnFloor,
  spawnToPixels,
  type LevelPlat,
  type LevelSpawn,
} from "@/lib/minigame/level";
import {
  exportLevelCode,
  importLevelCode,
  levelShareUrl,
  type SharedLevel,
} from "@/lib/minigame/levelShare";
import {
  aimAt,
  createPlayer,
  PLAYER_H,
  PLAYER_W,
  stepPlayer,
  tryPlacePortal,
  tryTeleport,
  type InputState,
  type Player,
  type Portal,
} from "@/lib/minigame/physics";

function canvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.clientWidth,
    y: ((clientY - rect.top) / rect.height) * canvas.clientHeight,
  };
}

type ReshapeMode = "free" | "rect" | "square";

type DragMode =
  | { kind: "move"; index: number; ox: number; oy: number; snapshot: Poly }
  | {
      kind: "vertex";
      index: number;
      vert: number;
      ox: number;
      oy: number;
      vx: number;
      vy: number;
    }
  | {
      kind: "box";
      index: number;
      vert: number;
      mode: "rect" | "square";
      snapshot: Poly;
    }
  | {
      kind: "rotate";
      index: number;
      mouseAngle0: number;
      snapshot: Poly;
    }
  | {
      kind: "spawn";
      ox: number;
      oy: number;
      sx: number;
      sy: number;
    };

function rotateHandleFor(p: Poly) {
  const c = polyCenter(p);
  return { x: c.x, y: c.y - 36 };
}

function clonePolyVerts(p: Poly): Poly {
  return {
    portalable: p.portalable,
    verts: p.verts.map((v) => ({ ...v })),
  };
}

export function PortalGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [reshapeMode, setReshapeMode] = useState<ReshapeMode>("free");
  const [pasteOpen, setPasteOpen] = useState(false);
  const pasteOpenRef = useRef(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);

  const playerRef = useRef<Player | null>(null);
  const layoutRef = useRef<LevelPlat[]>(cloneDefaultLevel());
  const spawnRef = useRef<LevelSpawn>(cloneDefaultSpawn());
  const spawnInitializedRef = useRef(false);
  const urlLevelHandledRef = useRef(false);
  const platformsRef = useRef<Poly[]>([]);
  const portalsRef = useRef<{ blue: Portal | null; orange: Portal | null }>({
    blue: null,
    orange: null,
  });
  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    jump: false,
  });
  const mouseRef = useRef({ x: 200, y: 200 });
  const jumpConsumedRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });
  const editingRef = useRef(false);
  const selectedRef = useRef(-1);
  const reshapeRef = useRef<ReshapeMode>("free");
  const dragRef = useRef<DragMode | null>(null);
  const spawnSelectedRef = useRef(false);
  const [spawnSelected, setSpawnSelected] = useState(false);
  const [selectedPortalable, setSelectedPortalable] = useState(true);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    selectedRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    reshapeRef.current = reshapeMode;
  }, [reshapeMode]);

  useEffect(() => {
    spawnSelectedRef.current = spawnSelected;
  }, [spawnSelected]);

  useEffect(() => {
    pasteOpenRef.current = pasteOpen;
  }, [pasteOpen]);

  const currentSpawnPixels = useCallback(() => {
    const { w, h } = sizeRef.current;
    return spawnToPixels(spawnRef.current, w, h);
  }, []);

  const respawnPlayer = useCallback(() => {
    const spawn = currentSpawnPixels();
    playerRef.current = createPlayer(spawn.x, spawn.y);
    playerRef.current.onGround = true;
    portalsRef.current = { blue: null, orange: null };
    mouseRef.current = { x: spawn.x + 80, y: spawn.y };
  }, [currentSpawnPixels]);

  const commitLayoutFromPlatforms = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w < 1 || h < 1) return;
    layoutRef.current = platformsToLayout(platformsRef.current, w, h);
  }, []);

  const commitSpawn = useCallback((x: number, y: number) => {
    const { w, h } = sizeRef.current;
    if (w < 1 || h < 1) return;
    const clampedX = Math.max(0, Math.min(w - PLAYER_W, x));
    const clampedY = Math.max(0, Math.min(h - PLAYER_H, y));
    spawnRef.current = pixelsToSpawn(clampedX, clampedY, w, h);
  }, []);

  const flashStatus = useCallback((message: string) => {
    setShareStatus(message);
    window.setTimeout(() => {
      setShareStatus((prev) => (prev === message ? null : prev));
    }, 2200);
  }, []);

  const applySharedLevel = useCallback(
    (level: SharedLevel, opts?: { enterPlay?: boolean }) => {
      layoutRef.current = level.platforms.map((p) => ({
        portalable: p.portalable !== false,
        verts: p.verts.map((v) => ({ ...v })),
      }));
      spawnRef.current = { ...level.spawn };
      spawnInitializedRef.current = true;
      setSelectedIndex(-1);
      setSpawnSelected(false);
      if (opts?.enterPlay !== false) {
        setEditing(false);
        dragRef.current = null;
      }
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) {
        platformsRef.current = layoutToPlatforms(layoutRef.current, w, h);
        respawnPlayer();
      } else {
        portalsRef.current = { blue: null, orange: null };
        playerRef.current = null;
      }
    },
    [respawnPlayer]
  );

  const resetLevel = useCallback(() => {
    const { w, h } = sizeRef.current;
    layoutRef.current = cloneDefaultLevel();
    platformsRef.current = layoutToPlatforms(layoutRef.current, w, h);
    const floorSpawn = spawnOnFloor(platformsRef.current, PLAYER_W, PLAYER_H);
    spawnRef.current = pixelsToSpawn(floorSpawn.x, floorSpawn.y, w, h);
    spawnInitializedRef.current = true;
    setSelectedIndex(-1);
    setSpawnSelected(false);
    respawnPlayer();
  }, [respawnPlayer]);

  const shareLevel = useCallback(async () => {
    commitLayoutFromPlatforms();
    try {
      setLoadingShare(true);
      const code = await exportLevelCode(layoutRef.current, spawnRef.current);
      const url = levelShareUrl(code);
      await navigator.clipboard.writeText(url);
      flashStatus("Share link copied");
    } catch {
      flashStatus("Could not copy share link");
    } finally {
      setLoadingShare(false);
    }
  }, [commitLayoutFromPlatforms, flashStatus]);

  const openPasteModal = useCallback(() => {
    setPasteText("");
    setPasteError(null);
    setPasteOpen(true);
  }, []);

  const closePasteModal = useCallback(() => {
    setPasteOpen(false);
    setPasteError(null);
  }, []);

  const submitPasteLevel = useCallback(async () => {
    setLoadingShare(true);
    setPasteError(null);
    try {
      const result = await importLevelCode(pasteText);
      if (!result.ok) {
        setPasteError(result.error);
        return;
      }
      applySharedLevel(result.level);
      setPasteOpen(false);
      flashStatus("Level loaded");
    } finally {
      setLoadingShare(false);
    }
  }, [applySharedLevel, flashStatus, pasteText]);

  // Boot from /play?level=...
  useEffect(() => {
    if (urlLevelHandledRef.current) return;
    const code = searchParams.get("level");
    if (!code) {
      urlLevelHandledRef.current = true;
      return;
    }
    urlLevelHandledRef.current = true;
    let cancelled = false;
    (async () => {
      const result = await importLevelCode(code);
      if (cancelled) return;
      if (!result.ok) {
        flashStatus(result.error);
        return;
      }
      applySharedLevel(result.level);
      flashStatus("Shared level loaded");
    })();
    return () => {
      cancelled = true;
    };
  }, [applySharedLevel, flashStatus, searchParams]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    document.body.classList.add("portal-game-active");

    const rebuild = () => {
      const parent = canvas.parentElement;
      const w = Math.max(320, parent?.clientWidth ?? window.innerWidth);
      const h = Math.max(320, parent?.clientHeight ?? window.innerHeight);
      sizeRef.current = { w, h };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      platformsRef.current = layoutToPlatforms(layoutRef.current, w, h);
      if (!spawnInitializedRef.current) {
        const floorSpawn = spawnOnFloor(
          platformsRef.current,
          PLAYER_W,
          PLAYER_H
        );
        spawnRef.current = pixelsToSpawn(floorSpawn.x, floorSpawn.y, w, h);
        spawnInitializedRef.current = true;
      }
      if (!playerRef.current) {
        respawnPlayer();
      } else if (!editingRef.current) {
        const spawn = spawnToPixels(spawnRef.current, w, h);
        playerRef.current.x = spawn.x;
        playerRef.current.y = spawn.y;
        playerRef.current.vx = 0;
        playerRef.current.vy = 0;
        playerRef.current.onGround = true;
        portalsRef.current = { blue: null, orange: null };
      }
    };

    rebuild();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        if (pasteOpenRef.current) {
          setPasteOpen(false);
          setPasteError(null);
          return;
        }
        if (editingRef.current) {
          setEditing(false);
          setSelectedIndex(-1);
          setSpawnSelected(false);
          dragRef.current = null;
          respawnPlayer();
          return;
        }
        router.push("/");
        return;
      }

      if (editingRef.current) {
        if (e.code === "Delete" || e.code === "Backspace") {
          e.preventDefault();
          const idx = selectedRef.current;
          if (idx >= 0 && platformsRef.current.length > 1) {
            platformsRef.current = platformsRef.current.filter((_, i) => i !== idx);
            commitLayoutFromPlatforms();
            setSelectedIndex(-1);
          }
        }
        return;
      }

      const input = inputRef.current;
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        input.left = true;
        e.preventDefault();
      }
      if (e.code === "KeyD" || e.code === "ArrowRight") {
        input.right = true;
        e.preventDefault();
      }
      if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") {
        if (!jumpConsumedRef.current) {
          input.jump = true;
          jumpConsumedRef.current = true;
        }
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const input = inputRef.current;
      if (e.code === "KeyA" || e.code === "ArrowLeft") input.left = false;
      if (e.code === "KeyD" || e.code === "ArrowRight") input.right = false;
      if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") {
        input.jump = false;
        jumpConsumedRef.current = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const pt = canvasPoint(canvas, e.clientX, e.clientY);
      mouseRef.current = pt;
      const drag = dragRef.current;
      if (!editingRef.current || !drag) return;

      if (drag.kind === "spawn") {
        commitSpawn(
          drag.sx + (pt.x - drag.ox),
          drag.sy + (pt.y - drag.oy)
        );
      } else if (drag.kind === "move") {
        const dx = pt.x - drag.ox;
        const dy = pt.y - drag.oy;
        platformsRef.current[drag.index] = {
          portalable: drag.snapshot.portalable,
          verts: drag.snapshot.verts.map((v) => ({
            x: v.x + dx,
            y: v.y + dy,
          })),
        };
      } else if (drag.kind === "vertex") {
        const p = platformsRef.current[drag.index];
        if (!p) return;
        p.verts[drag.vert].x = drag.vx + (pt.x - drag.ox);
        p.verts[drag.vert].y = drag.vy + (pt.y - drag.oy);
      } else if (drag.kind === "box") {
        const next = resizeQuadCorner(
          drag.snapshot,
          drag.vert,
          pt.x,
          pt.y,
          drag.mode
        );
        if (next) platformsRef.current[drag.index] = next;
      } else if (drag.kind === "rotate") {
        const c = polyCenter(drag.snapshot);
        const mouseAngle = Math.atan2(pt.y - c.y, pt.x - c.x);
        const delta = mouseAngle - drag.mouseAngle0;
        const next = clonePolyVerts(drag.snapshot);
        rotatePoly(next, delta, c);
        platformsRef.current[drag.index] = next;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const pt = canvasPoint(canvas, e.clientX, e.clientY);
      mouseRef.current = pt;

      if (editingRef.current) {
        if (e.button !== 0) return;
        e.preventDefault();

        const spawnPx = spawnToPixels(
          spawnRef.current,
          sizeRef.current.w,
          sizeRef.current.h
        );
        if (hitTestSpawn(spawnPx, pt.x, pt.y)) {
          setSpawnSelected(true);
          setSelectedIndex(-1);
          dragRef.current = {
            kind: "spawn",
            ox: pt.x,
            oy: pt.y,
            sx: spawnPx.x,
            sy: spawnPx.y,
          };
          return;
        }

        const idx = selectedRef.current;
        const selected = idx >= 0 ? platformsRef.current[idx] : null;

        if (selected) {
          const rh = rotateHandleFor(selected);
          if (Math.hypot(pt.x - rh.x, pt.y - rh.y) <= 12) {
            const c = polyCenter(selected);
            setSpawnSelected(false);
            dragRef.current = {
              kind: "rotate",
              index: idx,
              mouseAngle0: Math.atan2(pt.y - c.y, pt.x - c.x),
              snapshot: clonePolyVerts(selected),
            };
            return;
          }

          const vi = nearestVertex(selected, pt.x, pt.y, 12);
          if (vi >= 0) {
            setSpawnSelected(false);
            const mode = reshapeRef.current;
            if (
              (mode === "rect" || mode === "square") &&
              selected.verts.length === 4
            ) {
              dragRef.current = {
                kind: "box",
                index: idx,
                vert: vi,
                mode,
                snapshot: clonePolyVerts(selected),
              };
            } else {
              dragRef.current = {
                kind: "vertex",
                index: idx,
                vert: vi,
                ox: pt.x,
                oy: pt.y,
                vx: selected.verts[vi].x,
                vy: selected.verts[vi].y,
              };
            }
            return;
          }

          // Edge dots only in free mode (adding verts breaks box resize)
          if (reshapeRef.current === "free") {
            const edge = nearestEdge(selected, pt.x, pt.y);
            if (edge.dist <= 10) {
              const a = selected.verts[edge.index];
              const b =
                selected.verts[(edge.index + 1) % selected.verts.length];
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              if (Math.hypot(pt.x - mx, pt.y - my) <= 10) {
                insertVertexOnEdge(selected, edge.index);
                commitLayoutFromPlatforms();
                const newVert = edge.index + 1;
                setSpawnSelected(false);
                dragRef.current = {
                  kind: "vertex",
                  index: idx,
                  vert: newVert,
                  ox: pt.x,
                  oy: pt.y,
                  vx: selected.verts[newVert].x,
                  vy: selected.verts[newVert].y,
                };
                return;
              }
            }
          }
        }

        const hit = hitTestPlatform(platformsRef.current, pt.x, pt.y);
        setSelectedIndex(hit);
        setSpawnSelected(false);
        if (hit >= 0) {
          const p = platformsRef.current[hit];
          setSelectedPortalable(p.portalable !== false);
          dragRef.current = {
            kind: "move",
            index: hit,
            ox: pt.x,
            oy: pt.y,
            snapshot: clonePolyVerts(p),
          };
        } else {
          dragRef.current = null;
        }
        return;
      }

      const player = playerRef.current;
      if (!player) return;
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      const color = e.button === 0 ? "blue" : "orange";
      portalsRef.current = tryPlacePortal(
        player,
        pt.x,
        pt.y,
        color,
        platformsRef.current,
        portalsRef.current
      );
    };

    const onMouseUp = () => {
      if (dragRef.current) {
        commitLayoutFromPlatforms();
        dragRef.current = null;
      }
    };

    const onDblClick = (e: MouseEvent) => {
      if (!editingRef.current) return;
      const pt = canvasPoint(canvas, e.clientX, e.clientY);
      const idx = selectedRef.current;
      const p = idx >= 0 ? platformsRef.current[idx] : null;
      if (!p) return;
      const vi = nearestVertex(p, pt.x, pt.y, 12);
      if (vi >= 0 && removeVertex(p, vi)) {
        commitLayoutFromPlatforms();
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("resize", rebuild);

    let last = performance.now();
    let raf = 0;

    const tick = (ts: number) => {
      const dt = Math.min((ts - last) / 1000, 1 / 30);
      last = ts;

      const { w, h } = sizeRef.current;
      const mouse = mouseRef.current;

      clearCanvas(ctx, w, h);
      drawArenaBackground(ctx, w, h);

      const sel = selectedRef.current;
      const selectedPoly = sel >= 0 ? platformsRef.current[sel] : null;
      drawPlatforms(ctx, platformsRef.current, sel, {
        showHandles: editingRef.current,
        showEdgeDots: editingRef.current && reshapeRef.current === "free",
        rotateHandle:
          editingRef.current && selectedPoly
            ? rotateHandleFor(selectedPoly)
            : undefined,
      });

      if (editingRef.current) {
        drawSpawnMarker(
          ctx,
          spawnToPixels(spawnRef.current, w, h),
          spawnSelectedRef.current
        );
        drawEditorHud(ctx, w, reshapeRef.current);
        raf = requestAnimationFrame(tick);
        return;
      }

      const player = playerRef.current;
      if (!player) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const input = { ...inputRef.current };
      stepPlayer(player, input, platformsRef.current, dt, mouse.x);
      inputRef.current.jump = false;

      tryTeleport(player, portalsRef.current);

      if (player.y > h + 100 || player.x < -80 || player.x > w + 80) {
        const spawn = spawnToPixels(spawnRef.current, w, h);
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        player.portalFlight = 0;
        player.collisionGrace = 0;
        player.groundNx = 0;
        player.groundNy = -1;
      }

      const { hit } = aimAt(player, mouse.x, mouse.y, platformsRef.current);

      const { blue, orange } = portalsRef.current;
      if (blue) drawPortal(ctx, blue);
      if (orange) drawPortal(ctx, orange);

      drawAim(ctx, player, mouse.x, mouse.y, hit);
      drawStickFigure(ctx, player, mouse.x, mouse.y);
      drawHud(ctx, w);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove("portal-game-active");
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", rebuild);
    };
  }, [router, respawnPlayer, commitLayoutFromPlatforms, commitSpawn]);

  const addShape = (kind: "rect" | "square") => {
    const { w, h } = sizeRef.current;
    const shape =
      kind === "square" ? addSquarePlatform(w, h) : addRectPlatform(w, h);
    platformsRef.current = [...platformsRef.current, shape];
    commitLayoutFromPlatforms();
    setSelectedIndex(platformsRef.current.length - 1);
    setSelectedPortalable(true);
    setSpawnSelected(false);
    setReshapeMode(kind === "square" ? "square" : "rect");
  };

  const deleteSelected = () => {
    const idx = selectedIndex;
    if (idx < 0 || platformsRef.current.length <= 1) return;
    platformsRef.current = platformsRef.current.filter((_, i) => i !== idx);
    commitLayoutFromPlatforms();
    setSelectedIndex(-1);
  };

  const rotateSelected45 = () => {
    const idx = selectedIndex;
    if (idx < 0) return;
    rotatePoly(platformsRef.current[idx], Math.PI / 4);
    commitLayoutFromPlatforms();
  };

  const toggleSelectedPortalable = () => {
    const idx = selectedIndex;
    if (idx < 0) return;
    const p = platformsRef.current[idx];
    const next = p.portalable === false;
    p.portalable = next;
    setSelectedPortalable(next);
    commitLayoutFromPlatforms();
  };

  const toggleEditing = () => {
    if (editing) {
      setEditing(false);
      setSelectedIndex(-1);
      setSpawnSelected(false);
      dragRef.current = null;
      commitLayoutFromPlatforms();
      respawnPlayer();
    } else {
      portalsRef.current = { blue: null, orange: null };
      setEditing(true);
      setSelectedIndex(-1);
      setSpawnSelected(false);
    }
  };

  return (
    <div className="portal-game">
      <div className="portal-game-bar">
        <Link href="/" className="portal-game-back">
          ← Back
        </Link>
        <p className="portal-game-title">
          {editing ? "Level editor" : "Portal playground"}
        </p>
        <div className="portal-game-actions">
          {editing ? (
            <>
              <button
                type="button"
                className="portal-game-tool"
                onClick={() => addShape("rect")}
              >
                + Rect
              </button>
              <button
                type="button"
                className="portal-game-tool"
                onClick={() => addShape("square")}
              >
                + Square
              </button>
              <span className="portal-game-mode-group" role="group" aria-label="Resize mode">
                <button
                  type="button"
                  className={`portal-game-tool${reshapeMode === "free" ? " is-active" : ""}`}
                  onClick={() => setReshapeMode("free")}
                  title="Drag vertices freely"
                >
                  Free
                </button>
                <button
                  type="button"
                  className={`portal-game-tool${reshapeMode === "rect" ? " is-active" : ""}`}
                  onClick={() => setReshapeMode("rect")}
                  title="Corner-drag as a rectangle"
                >
                  Rect
                </button>
                <button
                  type="button"
                  className={`portal-game-tool${reshapeMode === "square" ? " is-active" : ""}`}
                  onClick={() => setReshapeMode("square")}
                  title="Corner-drag as a square"
                >
                  Square
                </button>
              </span>
              <button
                type="button"
                className="portal-game-tool"
                onClick={rotateSelected45}
                disabled={selectedIndex < 0}
                title="Rotate 45°"
              >
                Rotate 45°
              </button>
              <button
                type="button"
                className={`portal-game-tool${
                  selectedIndex >= 0 && !selectedPortalable ? " is-active" : ""
                }`}
                onClick={toggleSelectedPortalable}
                disabled={selectedIndex < 0}
                title="Toggle whether portals can stick to this surface"
              >
                {selectedIndex >= 0 && !selectedPortalable
                  ? "Solid"
                  : "Portalable"}
              </button>
              <button
                type="button"
                className="portal-game-tool"
                onClick={deleteSelected}
                disabled={selectedIndex < 0}
              >
                Delete
              </button>
              <button type="button" className="portal-game-tool" onClick={resetLevel}>
                Default
              </button>
              <button
                type="button"
                className="portal-game-tool"
                onClick={shareLevel}
                disabled={loadingShare}
                title="Copy a share link for this level"
              >
                Share
              </button>
              <button
                type="button"
                className="portal-game-tool portal-game-tool-primary"
                onClick={toggleEditing}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button type="button" className="portal-game-tool" onClick={toggleEditing}>
                Edit level
              </button>
              <button
                type="button"
                className="portal-game-tool"
                onClick={shareLevel}
                disabled={loadingShare}
                title="Copy a share link for this level"
              >
                Share
              </button>
              <button
                type="button"
                className="portal-game-tool"
                onClick={openPasteModal}
                title="Paste a level code or share link"
              >
                Load
              </button>
              <button type="button" className="portal-game-tool" onClick={resetLevel}>
                Reset
              </button>
            </>
          )}
        </div>
      </div>
      {shareStatus ? (
        <p className="portal-game-status" role="status">
          {shareStatus}
        </p>
      ) : null}
      <div className="portal-game-stage">
        <canvas
          ref={canvasRef}
          className={`portal-game-canvas${editing ? " is-editing" : ""}`}
          aria-label={editing ? "Level editor" : "Portal minigame arena"}
        />
      </div>
      {pasteOpen ? (
        <div
          className="portal-game-modal-backdrop"
          role="presentation"
          onClick={closePasteModal}
        >
          <div
            className="portal-game-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-load-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="portal-load-title" className="portal-game-modal-title">
              Load level
            </h2>
            <p className="portal-game-modal-lead">
              Paste a share link or level code to play someone else&apos;s layout.
            </p>
            <textarea
              className="portal-game-modal-input"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="p1_… or https://…/play?level=…"
              rows={5}
              autoFocus
            />
            {pasteError ? (
              <p className="portal-game-modal-error" role="alert">
                {pasteError}
              </p>
            ) : null}
            <div className="portal-game-modal-actions">
              <button
                type="button"
                className="portal-game-tool"
                onClick={closePasteModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="portal-game-tool portal-game-tool-primary"
                onClick={submitPasteLevel}
                disabled={loadingShare || !pasteText.trim()}
              >
                Load
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
