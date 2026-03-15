import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type ReadFileFn = (filePath: string) => Promise<Buffer>;

export type WebMediaLoadOptions = {
  maxBytes?: number;
  localRoots?: readonly string[];
  sandboxValidated?: boolean;
  readFile?: ReadFileFn;
};

export type WebMediaKind = "audio" | "document" | "image" | "video";

export type WebMediaResult = {
  kind: WebMediaKind;
  buffer: Buffer;
  contentType?: string;
  mimeType?: string;
  fileName?: string;
};

function normalizeLoadOptions(
  options?: number | WebMediaLoadOptions,
): WebMediaLoadOptions | undefined {
  if (typeof options === "number") {
    return { maxBytes: options };
  }
  return options;
}

function resolveMimeType(fileName?: string, contentType?: string): string | undefined {
  const normalizedContentType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalizedContentType) {
    return normalizedContentType;
  }

  const ext = path.extname(fileName ?? "").toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    default:
      return undefined;
  }
}

function resolveMediaKind(contentType?: string): WebMediaKind {
  const normalized = contentType?.toLowerCase() ?? "";
  if (normalized.startsWith("image/")) {
    return "image";
  }
  if (normalized.startsWith("audio/")) {
    return "audio";
  }
  if (normalized.startsWith("video/")) {
    return "video";
  }
  return "document";
}

function ensureMaxBytes(buffer: Buffer, maxBytes?: number): void {
  if (typeof maxBytes === "number" && Number.isFinite(maxBytes) && maxBytes > 0) {
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Media exceeds maxBytes (${buffer.byteLength} > ${maxBytes})`);
    }
  }
}

function getFileNameFromSource(source: string): string | undefined {
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      return path.basename(url.pathname) || undefined;
    } catch {
      return undefined;
    }
  }
  if (source.startsWith("file://")) {
    return path.basename(source.slice("file://".length)) || undefined;
  }
  return path.basename(source) || undefined;
}

function assertAllowedLocalPath(filePath: string, localRoots?: readonly string[]): void {
  if (!localRoots || localRoots.length === 0) {
    return;
  }
  const resolvedPath = path.resolve(filePath);
  for (const root of localRoots) {
    const resolvedRoot = path.resolve(root);
    if (resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
      return;
    }
  }
  throw new Error(`Local media path is outside allowed roots: ${filePath}`);
}

function decodeDataUrl(input: string): { buffer: Buffer; contentType?: string } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(input);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const [, contentTypeRaw, base64Flag, payload] = match;
  const buffer = base64Flag
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return {
    buffer,
    contentType: contentTypeRaw?.trim().toLowerCase() || undefined,
  };
}

async function readLocalBuffer(source: string, options?: WebMediaLoadOptions): Promise<Buffer> {
  const normalizedPath = source.startsWith("file://") ? source.slice("file://".length) : source;
  if (!options?.sandboxValidated) {
    assertAllowedLocalPath(normalizedPath, options?.localRoots);
  }
  const readFile = options?.readFile ?? (async (filePath: string) => await fs.readFile(filePath));
  return await readFile(normalizedPath);
}

async function readRemoteBuffer(source: string): Promise<{
  buffer: Buffer;
  contentType?: string;
  fileName?: string;
}> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") ?? undefined,
    fileName: getFileNameFromSource(source),
  };
}

export function getDefaultLocalRoots(): string[] {
  return Array.from(new Set([process.cwd(), os.homedir(), os.tmpdir()]));
}

export async function loadWebMediaRaw(
  source: string,
  options?: number | WebMediaLoadOptions,
): Promise<WebMediaResult> {
  const normalizedOptions = normalizeLoadOptions(options);
  let buffer: Buffer;
  let contentType: string | undefined;
  let fileName = getFileNameFromSource(source);

  if (source.startsWith("data:")) {
    const decoded = decodeDataUrl(source);
    buffer = decoded.buffer;
    contentType = decoded.contentType;
    fileName ??= "inline";
  } else if (/^https?:\/\//i.test(source)) {
    const remote = await readRemoteBuffer(source);
    buffer = remote.buffer;
    contentType = remote.contentType;
    fileName = remote.fileName ?? fileName;
  } else {
    buffer = await readLocalBuffer(source, normalizedOptions);
  }

  ensureMaxBytes(buffer, normalizedOptions?.maxBytes);
  const mimeType = resolveMimeType(fileName, contentType);
  return {
    kind: resolveMediaKind(mimeType),
    buffer,
    contentType: mimeType,
    mimeType,
    fileName,
  };
}

export async function loadWebMedia(
  source: string,
  options?: number | WebMediaLoadOptions,
): Promise<WebMediaResult> {
  return await loadWebMediaRaw(source, options);
}
