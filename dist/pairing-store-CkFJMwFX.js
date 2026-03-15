import os from "node:os";
import path from "node:path";
import fs from "node:fs";
//#region src/pairing/pairing-store.ts
function resolveBaseDir(env = process.env) {
	return env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
}
function resolveCredentialsDir(env = process.env) {
	return path.join(resolveBaseDir(env), "credentials");
}
function readAllowFromFile(targetPath) {
	if (!fs.existsSync(targetPath)) return [];
	try {
		const raw = fs.readFileSync(targetPath, "utf8");
		const parsed = JSON.parse(raw);
		return (Array.isArray(parsed?.allowFrom) ? parsed.allowFrom : Array.isArray(parsed) ? parsed : []).map((entry) => String(entry).trim()).filter(Boolean);
	} catch {
		return [];
	}
}
async function readChannelAllowFromStore(channel, env, accountId) {
	return readAllowFromFile(resolveChannelAllowFromPath(channel ?? "unknown", env, accountId));
}
function readChannelAllowFromStoreSync(channel, env, accountId) {
	return readAllowFromFile(resolveChannelAllowFromPath(channel ?? "unknown", env, accountId));
}
async function listChannelPairingRequests(_channel, _env = process.env, _accountId) {
	return [];
}
async function approveChannelPairingCode(_params) {
	return null;
}
function resolveChannelAllowFromPath(channel, env = process.env, accountId) {
	const credentialsDir = resolveCredentialsDir(env);
	const normalizedAccountId = accountId?.trim();
	if (!normalizedAccountId || normalizedAccountId.toLowerCase() === "default") return path.join(credentialsDir, `${channel}-allowFrom.json`);
	return path.join(credentialsDir, `${channel}-${normalizedAccountId}-allowFrom.json`);
}
//#endregion
export { resolveChannelAllowFromPath as a, readChannelAllowFromStoreSync as i, listChannelPairingRequests as n, readChannelAllowFromStore as r, approveChannelPairingCode as t };
