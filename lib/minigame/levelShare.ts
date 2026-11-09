import type { LevelPlat, LevelSpawn } from "./level";

export type SharedLevel = {
  platforms: LevelPlat[];
  spawn: LevelSpawn;
};

type LevelPayloadV1 = {
  v: 1;
  platforms: LevelPlat[];
  spawn: LevelSpawn;
};

export type ImportLevelResult =
  | { ok: true; level: SharedLevel }
  | { ok: false; error: string };

const CODE_PREFIX = "p1_";
const MAX_CODE_CHARS = 24_000;
const MAX_PLATFORMS = 40;
const MIN_PLATFORMS = 1;
const MIN_VERTS = 3;
const MAX_VERTS = 24;
const COORD_MIN = -0.5;
const COORD_MAX = 1.5;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function inCoordRange(n: number): boolean {
  return n >= COORD_MIN && n <= COORD_MAX;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

function textDecoder(): TextDecoder {
  return new TextDecoder();
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function compressBytes(raw: Uint8Array): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  if (typeof CompressionStream === "undefined") {
    return { bytes: raw, compressed: false };
  }
  try {
    const stream = new Blob([toArrayBuffer(raw)])
      .stream()
      .pipeThrough(new CompressionStream("deflate"));
    const buf = await new Response(stream).arrayBuffer();
    return { bytes: new Uint8Array(buf), compressed: true };
  } catch {
    return { bytes: raw, compressed: false };
  }
}

async function decompressBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Decompression is not supported in this browser");
  }
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export function validateSharedLevel(data: unknown): ImportLevelResult {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Invalid level data" };
  }
  const obj = data as Record<string, unknown>;
  if (obj.v !== 1) {
    return { ok: false, error: "Unsupported level version" };
  }
  if (!Array.isArray(obj.platforms)) {
    return { ok: false, error: "Level is missing platforms" };
  }
  if (obj.platforms.length < MIN_PLATFORMS || obj.platforms.length > MAX_PLATFORMS) {
    return { ok: false, error: "Level has too many or too few platforms" };
  }

  const platforms: LevelPlat[] = [];
  for (const raw of obj.platforms) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Invalid platform" };
    }
    const p = raw as Record<string, unknown>;
    if (!Array.isArray(p.verts)) {
      return { ok: false, error: "Platform is missing vertices" };
    }
    if (p.verts.length < MIN_VERTS || p.verts.length > MAX_VERTS) {
      return { ok: false, error: "Platform has an invalid vertex count" };
    }
    const verts: Array<{ x: number; y: number }> = [];
    for (const v of p.verts) {
      if (!v || typeof v !== "object") {
        return { ok: false, error: "Invalid vertex" };
      }
      const vert = v as Record<string, unknown>;
      if (!isFiniteNumber(vert.x) || !isFiniteNumber(vert.y)) {
        return { ok: false, error: "Vertex coordinates must be numbers" };
      }
      if (!inCoordRange(vert.x) || !inCoordRange(vert.y)) {
        return { ok: false, error: "Vertex is out of range" };
      }
      verts.push({ x: vert.x, y: vert.y });
    }
    platforms.push({
      portalable: p.portalable !== false,
      verts,
    });
  }

  const spawnRaw = obj.spawn;
  if (!spawnRaw || typeof spawnRaw !== "object") {
    return { ok: false, error: "Level is missing a spawn point" };
  }
  const spawnObj = spawnRaw as Record<string, unknown>;
  if (!isFiniteNumber(spawnObj.x) || !isFiniteNumber(spawnObj.y)) {
    return { ok: false, error: "Spawn coordinates must be numbers" };
  }
  if (!inCoordRange(spawnObj.x) || !inCoordRange(spawnObj.y)) {
    return { ok: false, error: "Spawn is out of range" };
  }

  return {
    ok: true,
    level: {
      platforms,
      spawn: { x: spawnObj.x, y: spawnObj.y },
    },
  };
}

export async function exportLevelCode(
  platforms: LevelPlat[],
  spawn: LevelSpawn
): Promise<string> {
  const checked = validateSharedLevel({
    v: 1,
    platforms,
    spawn,
  } satisfies LevelPayloadV1);
  if (!checked.ok) throw new Error(checked.error);

  const json = JSON.stringify({
    v: 1,
    platforms: checked.level.platforms,
    spawn: checked.level.spawn,
  } satisfies LevelPayloadV1);
  const raw = textEncoder().encode(json);
  const { bytes, compressed } = await compressBytes(raw);
  const body = bytesToBase64Url(bytes);
  return compressed ? `${CODE_PREFIX}${body}` : `${CODE_PREFIX}u_${body}`;
}

function extractCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Allow pasting a full URL with ?level=
  try {
    if (trimmed.includes("level=")) {
      const url = new URL(trimmed, "https://example.local");
      const fromQuery = url.searchParams.get("level");
      if (fromQuery) return fromQuery.trim();
    }
  } catch {
    // not a URL — treat as raw code
  }

  // Also accept "/play?level=..." relative pastes
  const match = trimmed.match(/[?&]level=([^&\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return trimmed;
}

export async function importLevelCode(input: string): Promise<ImportLevelResult> {
  const code = extractCode(input);
  if (!code) return { ok: false, error: "Paste a level code or share link" };
  if (code.length > MAX_CODE_CHARS) {
    return { ok: false, error: "Level code is too large" };
  }
  if (!code.startsWith(CODE_PREFIX)) {
    return { ok: false, error: "Not a recognized level code" };
  }

  const rest = code.slice(CODE_PREFIX.length);
  const uncompressed = rest.startsWith("u_");
  const body = uncompressed ? rest.slice(2) : rest;

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(body);
  } catch {
    return { ok: false, error: "Level code is corrupted" };
  }

  let jsonText: string;
  try {
    if (uncompressed) {
      jsonText = textDecoder().decode(bytes);
    } else {
      const raw = await decompressBytes(bytes);
      jsonText = textDecoder().decode(raw);
    }
  } catch {
    // Compressed payload that can't decompress — try raw JSON as last resort
    try {
      jsonText = textDecoder().decode(bytes);
    } catch {
      return { ok: false, error: "Could not read level code" };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Level code is not valid JSON" };
  }

  return validateSharedLevel(parsed);
}

export function levelShareUrl(code: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const path = `/play?level=${encodeURIComponent(code)}`;
  return base ? `${base}${path}` : path;
}
