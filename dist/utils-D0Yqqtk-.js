import { b as resolveRequiredHomeDir, v as resolveEffectiveHomeDir, y as resolveHomeRelativePath } from "./paths-dQ_clcF4.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
//#region src/infra/plain-object.ts
/**
* Strict plain-object guard (excludes arrays and host objects).
*/
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}
//#endregion
//#region src/utils.ts
async function ensureDir(dir) {
	await fs.promises.mkdir(dir, { recursive: true });
}
/**
* Check if a file or directory exists at the given path.
*/
async function pathExists(targetPath) {
	try {
		await fs.promises.access(targetPath);
		return true;
	} catch {
		return false;
	}
}
function clampNumber(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
function clampInt(value, min, max) {
	return clampNumber(Math.floor(value), min, max);
}
/** Alias for clampNumber (shorter, more common name) */
const clamp = clampNumber;
/**
* Escapes special regex characters in a string so it can be used in a RegExp constructor.
*/
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
* Type guard for Record<string, unknown> (less strict than isPlainObject).
* Accepts any non-null object that isn't an array.
*/
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeE164(number) {
	const digits = number.replace(/^whatsapp:/, "").trim().replace(/[^\d+]/g, "");
	if (digits.startsWith("+")) return `+${digits.slice(1)}`;
	return `+${digits}`;
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function isHighSurrogate(codeUnit) {
	return codeUnit >= 55296 && codeUnit <= 56319;
}
function isLowSurrogate(codeUnit) {
	return codeUnit >= 56320 && codeUnit <= 57343;
}
function sliceUtf16Safe(input, start, end) {
	const len = input.length;
	let from = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
	let to = end === void 0 ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
	if (to < from) {
		const tmp = from;
		from = to;
		to = tmp;
	}
	if (from > 0 && from < len) {
		if (isLowSurrogate(input.charCodeAt(from)) && isHighSurrogate(input.charCodeAt(from - 1))) from += 1;
	}
	if (to > 0 && to < len) {
		if (isHighSurrogate(input.charCodeAt(to - 1)) && isLowSurrogate(input.charCodeAt(to))) to -= 1;
	}
	return input.slice(from, to);
}
function truncateUtf16Safe(input, maxLen) {
	const limit = Math.max(0, Math.floor(maxLen));
	if (input.length <= limit) return input;
	return sliceUtf16Safe(input, 0, limit);
}
function resolveUserPath(input, env = process.env, homedir = os.homedir) {
	if (!input) return "";
	return resolveHomeRelativePath(input, {
		env,
		homedir
	});
}
function resolveConfigDir(env = process.env, homedir = os.homedir) {
	const override = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
	if (override) return resolveUserPath(override, env, homedir);
	const newDir = path.join(resolveRequiredHomeDir(env, homedir), ".openclaw");
	try {
		if (fs.existsSync(newDir)) return newDir;
	} catch {}
	return newDir;
}
function resolveHomeDir() {
	return resolveEffectiveHomeDir(process.env, os.homedir);
}
function resolveHomeDisplayPrefix() {
	const home = resolveHomeDir();
	if (!home) return;
	if (process.env.OPENCLAW_HOME?.trim()) return {
		home,
		prefix: "$OPENCLAW_HOME"
	};
	return {
		home,
		prefix: "~"
	};
}
function shortenHomePath(input) {
	if (!input) return input;
	const display = resolveHomeDisplayPrefix();
	if (!display) return input;
	const { home, prefix } = display;
	if (input === home) return prefix;
	if (input.startsWith(`${home}/`) || input.startsWith(`${home}\\`)) return `${prefix}${input.slice(home.length)}`;
	return input;
}
function shortenHomeInString(input) {
	if (!input) return input;
	const display = resolveHomeDisplayPrefix();
	if (!display) return input;
	return input.split(display.home).join(display.prefix);
}
function displayPath(input) {
	return shortenHomePath(input);
}
function displayString(input) {
	return shortenHomeInString(input);
}
function formatTerminalLink(label, url, opts) {
	const esc = "\x1B";
	const safeLabel = label.replaceAll(esc, "");
	const safeUrl = url.replaceAll(esc, "");
	if (!(opts?.force === true ? true : opts?.force === false ? false : Boolean(process.stdout.isTTY))) return opts?.fallback ?? `${safeLabel} (${safeUrl})`;
	return `\u001b]8;;${safeUrl}\u0007${safeLabel}\u001b]8;;\u0007`;
}
const CONFIG_DIR = resolveConfigDir();
//#endregion
export { shortenHomePath as _, displayPath as a, truncateUtf16Safe as b, escapeRegExp as c, normalizeE164 as d, pathExists as f, shortenHomeInString as g, resolveUserPath as h, clampNumber as i, formatTerminalLink as l, resolveHomeDir as m, clamp as n, displayString as o, resolveConfigDir as p, clampInt as r, ensureDir as s, CONFIG_DIR as t, isRecord as u, sleep as v, isPlainObject as x, sliceUtf16Safe as y };
