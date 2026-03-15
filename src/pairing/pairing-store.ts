import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function resolveBaseDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
}

function resolveCredentialsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveBaseDir(env), "credentials");
}

function readAllowFromFile(targetPath: string): string[] {
  if (!fs.existsSync(targetPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(targetPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const parsedRecord =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { allowFrom?: unknown })
        : undefined;
    const allowFrom = Array.isArray(parsedRecord?.allowFrom)
      ? parsedRecord.allowFrom
      : Array.isArray(parsed)
        ? parsed
        : [];
    return allowFrom.map((entry) => String(entry).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function writeAllowFromFile(targetPath: string, entries: string[]): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify({ version: 1, allowFrom: entries }, null, 2), "utf8");
}

export async function readChannelAllowFromStore(
  channel?: string,
  env?: NodeJS.ProcessEnv,
  accountId?: string,
): Promise<string[]> {
  return readAllowFromFile(resolveChannelAllowFromPath(channel ?? "unknown", env, accountId));
}

export function readChannelAllowFromStoreSync(
  channel?: string,
  env?: NodeJS.ProcessEnv,
  accountId?: string,
): string[] {
  return readAllowFromFile(resolveChannelAllowFromPath(channel ?? "unknown", env, accountId));
}

export async function upsertChannelPairingRequest(_params: {
  channel: string;
  id: string;
  accountId?: string;
  meta?: unknown;
  env?: NodeJS.ProcessEnv;
  pairingAdapter?: unknown;
}): Promise<{ code: string; created: boolean }> {
  return { code: "000000", created: false };
}

export async function listChannelPairingRequests(
  _channel: string,
  _env: NodeJS.ProcessEnv = process.env,
  _accountId?: string,
): Promise<Array<{ code: string; id: string; meta?: unknown; createdAt: string }>> {
  return [];
}

export async function approveChannelPairingCode(_params: {
  channel: string;
  code: string;
  accountId?: string;
}): Promise<{ code: string; id: string } | null> {
  return null;
}

export async function addChannelAllowFromStoreEntry(_params: {
  channel: string;
  entry: string;
  accountId?: string;
}): Promise<void> {
  const targetPath = resolveChannelAllowFromPath(_params.channel, process.env, _params.accountId);
  const entries = readAllowFromFile(targetPath);
  if (!entries.includes(_params.entry)) {
    entries.push(_params.entry);
    writeAllowFromFile(targetPath, entries);
  }
}

export async function removeChannelAllowFromStoreEntry(_params: {
  channel: string;
  entry: string;
  accountId?: string;
}): Promise<void> {
  const targetPath = resolveChannelAllowFromPath(_params.channel, process.env, _params.accountId);
  const entries = readAllowFromFile(targetPath).filter((entry) => entry !== _params.entry);
  writeAllowFromFile(targetPath, entries);
}

export function resolveChannelAllowFromPath(
  channel: string,
  env: NodeJS.ProcessEnv = process.env,
  accountId?: string,
): string {
  const credentialsDir = resolveCredentialsDir(env);
  const normalizedAccountId = accountId?.trim();
  if (!normalizedAccountId || normalizedAccountId.toLowerCase() === "default") {
    return path.join(credentialsDir, `${channel}-allowFrom.json`);
  }
  return path.join(credentialsDir, `${channel}-${normalizedAccountId}-allowFrom.json`);
}
