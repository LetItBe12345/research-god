import { C as setVerbose, M as getResolvedLoggerSettings, _ as danger, f as defaultRuntime, k as theme } from "./subsystem-C1ZwgyXv.js";
import "./paths-dQ_clcF4.js";
import "./boolean-BHdNsbzF.js";
import { $ as resolveCommandSecretRefsViaGateway, Aa as callGateway, Dp as readConfigFileSnapshot, En as hasResolvedCredentialValue, G as withProgress, Tn as hasConfiguredUnavailableCredentialStatus, Y as getChannelsCommandSecretTargetIds, _u as normalizeChannelId, bi as formatTimeAgo, gt as resolveMessageChannelSelection, gu as listChannelPlugins, h as loadAuthProfileStore, hu as getChannelPlugin, oi as loadProviderUsageSummary, q as formatHelpExamples, si as formatUsageReportLines, wp as loadConfig, yu as resolveChannelDefaultAccountId } from "./auth-profiles-DZ4zIQH4.js";
import { t as formatCliCommand } from "./command-format-CO3N-oGG.js";
import "./agent-scope-lHks6gb9.js";
import "./session-key-9lbhEIb9.js";
import "./utils-D0Yqqtk-.js";
import "./boundary-file-read-Dra285K5.js";
import "./exec-BMx4PoTI.js";
import "./github-copilot-token-Dmorf6Ne.js";
import "./skills-NeRNNbEl.js";
import "./frontmatter-BzGWVIyf.js";
import "./env-overrides-D54I1R12.js";
import "./version-Yn0NaOik.js";
import "./search-manager-Cs4X-3T9.js";
import "./query-expansion-C-xoIovu.js";
import "./redact-Dc1bGBfo.js";
import "./errors-BIQILtBT.js";
import "./path-alias-guards-DpKou6ZY.js";
import "./cmd-argv-DN-N1T_K.js";
import "./restart-stale-pids-C-OA8Ze0.js";
import "./delivery-queue-DCXFvPmD.js";
import "./paths-CmL1n6G7.js";
import "./session-cost-usage-Zj7Y3VA9.js";
import { t as formatDocsLink } from "./links-BmJbo-zG.js";
import { n as runCommandWithRuntime } from "./cli-utils-Cc7goTOv.js";
import { t as hasExplicitOptions } from "./command-options-LK1l2nka.js";
import { n as buildReadOnlySourceChannelAccountSnapshot, t as buildChannelAccountSnapshot } from "./status-CbKxGhJb.js";
import "./issue-format-C8GXLHk1.js";
import { t as requireValidConfigSnapshot } from "./config-validation-BaBpwqUg.js";
import { t as parseLogLine } from "./parse-log-line-CVVwEQDH.js";
import { t as collectChannelStatusIssues } from "./channels-status-issues-DJuh_W22.js";
import "./plugin-registry-ev_8vRX-.js";
import { t as formatCliChannelOptions } from "./channel-options-cS_fl331.js";
import fs from "node:fs/promises";
//#region src/commands/channels/shared.ts
async function requireValidConfig(runtime = defaultRuntime, secretResolution) {
	const cfg = await requireValidConfigSnapshot(runtime);
	if (!cfg) return null;
	const { resolvedConfig, diagnostics } = await resolveCommandSecretRefsViaGateway({
		config: cfg,
		commandName: secretResolution?.commandName ?? "channels",
		targetIds: getChannelsCommandSecretTargetIds(),
		mode: secretResolution?.mode
	});
	for (const entry of diagnostics) runtime.log(`[secrets] ${entry}`);
	return resolvedConfig;
}
function formatAccountLabel(params) {
	const base = params.accountId || "default";
	if (params.name?.trim()) return `${base} (${params.name.trim()})`;
	return base;
}
const channelLabel = (channel) => {
	return getChannelPlugin(channel)?.meta.label ?? channel;
};
function formatChannelAccountLabel(params) {
	const channelText = channelLabel(params.channel);
	const accountText = formatAccountLabel({
		accountId: params.accountId,
		name: params.name
	});
	return `${params.channelStyle ? params.channelStyle(channelText) : channelText} ${params.accountStyle ? params.accountStyle(accountText) : accountText}`;
}
//#endregion
//#region src/commands/channels/list.ts
const colorValue = (value) => {
	if (value === "none") return theme.error(value);
	if (value === "env") return theme.accent(value);
	return theme.success(value);
};
function formatEnabled(value) {
	return value === false ? theme.error("disabled") : theme.success("enabled");
}
function formatConfigured(value) {
	return value ? theme.success("configured") : theme.warn("not configured");
}
function formatTokenSource(source) {
	return `token=${colorValue(source || "none")}`;
}
function formatSource(label, source) {
	return `${label}=${colorValue(source || "none")}`;
}
function formatLinked(value) {
	return value ? theme.success("linked") : theme.warn("not linked");
}
function shouldShowConfigured(channel) {
	return channel.meta.showConfigured !== false;
}
function formatAccountLine(params) {
	const { channel, snapshot } = params;
	const label = formatChannelAccountLabel({
		channel: channel.id,
		accountId: snapshot.accountId,
		name: snapshot.name,
		channelStyle: theme.accent,
		accountStyle: theme.heading
	});
	const bits = [];
	if (snapshot.linked !== void 0) bits.push(formatLinked(snapshot.linked));
	if (shouldShowConfigured(channel) && typeof snapshot.configured === "boolean") bits.push(formatConfigured(snapshot.configured));
	if (snapshot.tokenSource) bits.push(formatTokenSource(snapshot.tokenSource));
	if (snapshot.botTokenSource) bits.push(formatSource("bot", snapshot.botTokenSource));
	if (snapshot.appTokenSource) bits.push(formatSource("app", snapshot.appTokenSource));
	if (snapshot.baseUrl) bits.push(`base=${theme.muted(snapshot.baseUrl)}`);
	if (typeof snapshot.enabled === "boolean") bits.push(formatEnabled(snapshot.enabled));
	return `- ${label}: ${bits.join(", ")}`;
}
async function loadUsageWithProgress(runtime) {
	try {
		return await withProgress({
			label: "Fetching usage snapshot…",
			indeterminate: true,
			enabled: true
		}, async () => await loadProviderUsageSummary());
	} catch (err) {
		runtime.error(String(err));
		return null;
	}
}
async function channelsListCommand(opts, runtime = defaultRuntime) {
	const cfg = await requireValidConfig(runtime);
	if (!cfg) return;
	const includeUsage = opts.usage !== false;
	const plugins = listChannelPlugins();
	const authStore = loadAuthProfileStore();
	const authProfiles = Object.entries(authStore.profiles).map(([profileId, profile]) => ({
		id: profileId,
		provider: profile.provider,
		type: profile.type,
		isExternal: false
	}));
	if (opts.json) {
		const usage = includeUsage ? await loadProviderUsageSummary() : void 0;
		const chat = {};
		for (const plugin of plugins) chat[plugin.id] = plugin.config.listAccountIds(cfg);
		const payload = {
			chat,
			auth: authProfiles,
			...usage ? { usage } : {}
		};
		runtime.log(JSON.stringify(payload, null, 2));
		return;
	}
	const lines = [];
	lines.push(theme.heading("Chat channels:"));
	for (const plugin of plugins) {
		const accounts = plugin.config.listAccountIds(cfg);
		if (!accounts || accounts.length === 0) continue;
		for (const accountId of accounts) {
			const snapshot = await buildChannelAccountSnapshot({
				plugin,
				cfg,
				accountId
			});
			lines.push(formatAccountLine({
				channel: plugin,
				snapshot
			}));
		}
	}
	lines.push("");
	lines.push(theme.heading("Auth providers (OAuth + API keys):"));
	if (authProfiles.length === 0) lines.push(theme.muted("- none"));
	else for (const profile of authProfiles) {
		const external = profile.isExternal ? theme.muted(" (synced)") : "";
		lines.push(`- ${theme.accent(profile.id)} (${theme.success(profile.type)}${external})`);
	}
	runtime.log(lines.join("\n"));
	if (includeUsage) {
		runtime.log("");
		const usage = await loadUsageWithProgress(runtime);
		if (usage) {
			const usageLines = formatUsageReportLines(usage);
			if (usageLines.length > 0) {
				usageLines[0] = theme.accent(usageLines[0]);
				runtime.log(usageLines.join("\n"));
			}
		}
	}
	runtime.log("");
	runtime.log(`Docs: ${formatDocsLink("/gateway/configuration", "gateway/configuration")}`);
}
//#endregion
//#region src/commands/channels/logs.ts
const DEFAULT_LIMIT = 200;
const MAX_BYTES = 1e6;
const getChannelSet = () => new Set([...listChannelPlugins().map((plugin) => plugin.id), "all"]);
function parseChannelFilter(raw) {
	const trimmed = raw?.trim().toLowerCase();
	if (!trimmed) return "all";
	return getChannelSet().has(trimmed) ? trimmed : "all";
}
function matchesChannel(line, channel) {
	if (channel === "all") return true;
	const needle = `gateway/channels/${channel}`;
	if (line.subsystem?.includes(needle)) return true;
	if (line.module?.includes(channel)) return true;
	return false;
}
async function readTailLines(file, limit) {
	const stat = await fs.stat(file).catch(() => null);
	if (!stat) return [];
	const size = stat.size;
	const start = Math.max(0, size - MAX_BYTES);
	const handle = await fs.open(file, "r");
	try {
		const length = Math.max(0, size - start);
		if (length === 0) return [];
		const buffer = Buffer.alloc(length);
		const readResult = await handle.read(buffer, 0, length, start);
		let lines = buffer.toString("utf8", 0, readResult.bytesRead).split("\n");
		if (start > 0) lines = lines.slice(1);
		if (lines.length && lines[lines.length - 1] === "") lines = lines.slice(0, -1);
		if (lines.length > limit) lines = lines.slice(lines.length - limit);
		return lines;
	} finally {
		await handle.close();
	}
}
async function channelsLogsCommand(opts, runtime = defaultRuntime) {
	const channel = parseChannelFilter(opts.channel);
	const limitRaw = typeof opts.lines === "string" ? Number(opts.lines) : opts.lines;
	const limit = typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : DEFAULT_LIMIT;
	const file = getResolvedLoggerSettings().file;
	const filtered = (await readTailLines(file, limit * 4)).map(parseLogLine).filter((line) => Boolean(line)).filter((line) => matchesChannel(line, channel));
	const lines = filtered.slice(Math.max(0, filtered.length - limit));
	if (opts.json) {
		runtime.log(JSON.stringify({
			file,
			channel,
			lines
		}, null, 2));
		return;
	}
	runtime.log(theme.info(`Log file: ${file}`));
	if (channel !== "all") runtime.log(theme.info(`Channel: ${channel}`));
	if (lines.length === 0) {
		runtime.log(theme.muted("No matching log lines."));
		return;
	}
	for (const line of lines) {
		const ts = line.time ? `${line.time} ` : "";
		const level = line.level ? `${line.level.toLowerCase()} ` : "";
		runtime.log(`${ts}${level}${line.message}`.trim());
	}
}
//#endregion
//#region src/commands/channels/resolve.ts
function resolvePreferredKind(kind) {
	if (!kind || kind === "auto") return;
	if (kind === "user") return "user";
	return "group";
}
function detectAutoKind(input) {
	const trimmed = input.trim();
	if (!trimmed) return "group";
	if (trimmed.startsWith("@")) return "user";
	if (/^<@!?/.test(trimmed)) return "user";
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "user";
	if (/^(user|discord|slack|matrix|msteams|teams|zalo|zalouser|googlechat|google-chat|gchat):/i.test(trimmed)) return "user";
	return "group";
}
function formatResolveResult(result) {
	if (!result.resolved || !result.id) return `${result.input} -> unresolved`;
	const name = result.name ? ` (${result.name})` : "";
	const note = result.note ? ` [${result.note}]` : "";
	return `${result.input} -> ${result.id}${name}${note}`;
}
async function channelsResolveCommand(opts, runtime) {
	const { resolvedConfig: cfg, diagnostics } = await resolveCommandSecretRefsViaGateway({
		config: loadConfig(),
		commandName: "channels resolve",
		targetIds: getChannelsCommandSecretTargetIds(),
		mode: "operational_readonly"
	});
	for (const entry of diagnostics) runtime.log(`[secrets] ${entry}`);
	const entries = (opts.entries ?? []).map((entry) => entry.trim()).filter(Boolean);
	if (entries.length === 0) throw new Error("At least one entry is required.");
	const selection = await resolveMessageChannelSelection({
		cfg,
		channel: opts.channel ?? null
	});
	const plugin = getChannelPlugin(selection.channel);
	if (!plugin?.resolver?.resolveTargets) throw new Error(`Channel ${selection.channel} does not support resolve.`);
	const preferredKind = resolvePreferredKind(opts.kind);
	let results = [];
	if (preferredKind) results = (await plugin.resolver.resolveTargets({
		cfg,
		accountId: opts.account ?? null,
		inputs: entries,
		kind: preferredKind,
		runtime
	})).map((entry) => ({
		input: entry.input,
		resolved: entry.resolved,
		id: entry.id,
		name: entry.name,
		note: entry.note
	}));
	else {
		const byKind = /* @__PURE__ */ new Map();
		for (const entry of entries) {
			const kind = detectAutoKind(entry);
			byKind.set(kind, [...byKind.get(kind) ?? [], entry]);
		}
		const resolved = [];
		for (const [kind, inputs] of byKind.entries()) {
			const batch = await plugin.resolver.resolveTargets({
				cfg,
				accountId: opts.account ?? null,
				inputs,
				kind,
				runtime
			});
			resolved.push(...batch);
		}
		const byInput = new Map(resolved.map((entry) => [entry.input, entry]));
		results = entries.map((input) => {
			const entry = byInput.get(input);
			return {
				input,
				resolved: entry?.resolved ?? false,
				id: entry?.id,
				name: entry?.name,
				note: entry?.note
			};
		});
	}
	if (opts.json) {
		runtime.log(JSON.stringify(results, null, 2));
		return;
	}
	for (const result of results) if (result.resolved && result.id) runtime.log(formatResolveResult(result));
	else runtime.error(danger(`${result.input} -> unresolved${result.error ? ` (${result.error})` : result.note ? ` (${result.note})` : ""}`));
}
//#endregion
//#region src/commands/channels/status.ts
function appendEnabledConfiguredLinkedBits(bits, account) {
	if (typeof account.enabled === "boolean") bits.push(account.enabled ? "enabled" : "disabled");
	if (typeof account.configured === "boolean") if (account.configured) {
		bits.push("configured");
		if (hasConfiguredUnavailableCredentialStatus(account)) bits.push("secret unavailable in this command path");
	} else bits.push("not configured");
	if (typeof account.linked === "boolean") bits.push(account.linked ? "linked" : "not linked");
}
function appendModeBit(bits, account) {
	if (typeof account.mode === "string" && account.mode.length > 0) bits.push(`mode:${account.mode}`);
}
function appendTokenSourceBits(bits, account) {
	const appendSourceBit = (label, sourceKey, statusKey) => {
		const source = account[sourceKey];
		if (typeof source !== "string" || !source || source === "none") return;
		const unavailable = account[statusKey] === "configured_unavailable" ? " (unavailable)" : "";
		bits.push(`${label}:${source}${unavailable}`);
	};
	appendSourceBit("token", "tokenSource", "tokenStatus");
	appendSourceBit("bot", "botTokenSource", "botTokenStatus");
	appendSourceBit("app", "appTokenSource", "appTokenStatus");
	appendSourceBit("signing", "signingSecretSource", "signingSecretStatus");
}
function appendBaseUrlBit(bits, account) {
	if (typeof account.baseUrl === "string" && account.baseUrl) bits.push(`url:${account.baseUrl}`);
}
function buildChannelAccountLine(provider, account, bits) {
	return `- ${formatChannelAccountLabel({
		channel: provider,
		accountId: typeof account.accountId === "string" ? account.accountId : "default",
		name: (typeof account.name === "string" ? account.name.trim() : "") || void 0
	})}: ${bits.join(", ")}`;
}
function formatGatewayChannelsStatusLines(payload) {
	const lines = [];
	lines.push(theme.success("Gateway reachable."));
	const accountLines = (provider, accounts) => accounts.map((account) => {
		const bits = [];
		appendEnabledConfiguredLinkedBits(bits, account);
		if (typeof account.running === "boolean") bits.push(account.running ? "running" : "stopped");
		if (typeof account.connected === "boolean") bits.push(account.connected ? "connected" : "disconnected");
		const inboundAt = typeof account.lastInboundAt === "number" && Number.isFinite(account.lastInboundAt) ? account.lastInboundAt : null;
		const outboundAt = typeof account.lastOutboundAt === "number" && Number.isFinite(account.lastOutboundAt) ? account.lastOutboundAt : null;
		if (inboundAt) bits.push(`in:${formatTimeAgo(Date.now() - inboundAt)}`);
		if (outboundAt) bits.push(`out:${formatTimeAgo(Date.now() - outboundAt)}`);
		appendModeBit(bits, account);
		const botUsername = (() => {
			const bot = account.bot;
			const probeBot = account.probe?.bot;
			const raw = bot?.username ?? probeBot?.username ?? "";
			if (typeof raw !== "string") return "";
			const trimmed = raw.trim();
			if (!trimmed) return "";
			return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
		})();
		if (botUsername) bits.push(`bot:${botUsername}`);
		if (typeof account.dmPolicy === "string" && account.dmPolicy.length > 0) bits.push(`dm:${account.dmPolicy}`);
		if (Array.isArray(account.allowFrom) && account.allowFrom.length > 0) bits.push(`allow:${account.allowFrom.slice(0, 2).join(",")}`);
		appendTokenSourceBits(bits, account);
		const messageContent = account.application?.intents?.messageContent;
		if (typeof messageContent === "string" && messageContent.length > 0 && messageContent !== "enabled") bits.push(`intents:content=${messageContent}`);
		if (account.allowUnmentionedGroups === true) bits.push("groups:unmentioned");
		appendBaseUrlBit(bits, account);
		const probe = account.probe;
		if (probe && typeof probe.ok === "boolean") bits.push(probe.ok ? "works" : "probe failed");
		const audit = account.audit;
		if (audit && typeof audit.ok === "boolean") bits.push(audit.ok ? "audit ok" : "audit failed");
		if (typeof account.lastError === "string" && account.lastError) bits.push(`error:${account.lastError}`);
		return buildChannelAccountLine(provider, account, bits);
	});
	const plugins = listChannelPlugins();
	const accountsByChannel = payload.channelAccounts;
	const accountPayloads = {};
	for (const plugin of plugins) {
		const raw = accountsByChannel?.[plugin.id];
		if (Array.isArray(raw)) accountPayloads[plugin.id] = raw;
	}
	for (const plugin of plugins) {
		const accounts = accountPayloads[plugin.id];
		if (accounts && accounts.length > 0) lines.push(...accountLines(plugin.id, accounts));
	}
	lines.push("");
	const issues = collectChannelStatusIssues(payload);
	if (issues.length > 0) {
		lines.push(theme.warn("Warnings:"));
		for (const issue of issues) lines.push(`- ${issue.channel} ${issue.accountId}: ${issue.message}${issue.fix ? ` (${issue.fix})` : ""}`);
		lines.push(`- Run: ${formatCliCommand("openclaw doctor")}`);
		lines.push("");
	}
	lines.push(`Tip: ${formatDocsLink("/cli#status", "status --deep")} adds gateway health probes to status output (requires a reachable gateway).`);
	return lines;
}
async function formatConfigChannelsStatusLines(cfg, meta, opts) {
	const lines = [];
	lines.push(theme.warn("Gateway not reachable; showing config-only status."));
	if (meta.path) lines.push(`Config: ${meta.path}`);
	if (meta.mode) lines.push(`Mode: ${meta.mode}`);
	if (meta.path || meta.mode) lines.push("");
	const accountLines = (provider, accounts) => accounts.map((account) => {
		const bits = [];
		appendEnabledConfiguredLinkedBits(bits, account);
		appendModeBit(bits, account);
		appendTokenSourceBits(bits, account);
		appendBaseUrlBit(bits, account);
		return buildChannelAccountLine(provider, account, bits);
	});
	const plugins = listChannelPlugins();
	const sourceConfig = opts?.sourceConfig ?? cfg;
	for (const plugin of plugins) {
		const accountIds = plugin.config.listAccountIds(cfg);
		if (!accountIds.length) continue;
		const snapshots = [];
		for (const accountId of accountIds) {
			const sourceSnapshot = await buildReadOnlySourceChannelAccountSnapshot({
				plugin,
				cfg: sourceConfig,
				accountId
			});
			const resolvedSnapshot = await buildChannelAccountSnapshot({
				plugin,
				cfg,
				accountId
			});
			snapshots.push(sourceSnapshot && hasConfiguredUnavailableCredentialStatus(sourceSnapshot) && (!hasResolvedCredentialValue(resolvedSnapshot) || sourceSnapshot.configured === true && resolvedSnapshot.configured === false) ? sourceSnapshot : resolvedSnapshot);
		}
		if (snapshots.length > 0) lines.push(...accountLines(plugin.id, snapshots));
	}
	lines.push("");
	lines.push(`Tip: ${formatDocsLink("/cli#status", "status --deep")} adds gateway health probes to status output (requires a reachable gateway).`);
	return lines;
}
async function channelsStatusCommand(opts, runtime = defaultRuntime) {
	const timeoutMs = Number(opts.timeout ?? 1e4);
	const statusLabel = opts.probe ? "Checking channel status (probe)…" : "Checking channel status…";
	if (opts.json !== true && !process.stderr.isTTY) runtime.log(statusLabel);
	try {
		const payload = await withProgress({
			label: statusLabel,
			indeterminate: true,
			enabled: opts.json !== true
		}, async () => await callGateway({
			method: "channels.status",
			params: {
				probe: Boolean(opts.probe),
				timeoutMs
			},
			timeoutMs
		}));
		if (opts.json) {
			runtime.log(JSON.stringify(payload, null, 2));
			return;
		}
		runtime.log(formatGatewayChannelsStatusLines(payload).join("\n"));
	} catch (err) {
		runtime.error(`Gateway not reachable: ${String(err)}`);
		const cfg = await requireValidConfigSnapshot(runtime);
		if (!cfg) return;
		const { resolvedConfig, diagnostics } = await resolveCommandSecretRefsViaGateway({
			config: cfg,
			commandName: "channels status",
			targetIds: getChannelsCommandSecretTargetIds(),
			mode: "summary"
		});
		for (const entry of diagnostics) runtime.log(`[secrets] ${entry}`);
		const snapshot = await readConfigFileSnapshot();
		const mode = cfg.gateway?.mode === "remote" ? "remote" : "local";
		runtime.log((await formatConfigChannelsStatusLines(resolvedConfig, {
			path: snapshot.path,
			mode
		}, { sourceConfig: cfg })).join("\n"));
	}
}
//#endregion
//#region src/commands/channels.ts
function unsupported() {
	throw new Error("Channel mutation commands are unavailable in this trimmed build.");
}
async function channelsAddCommand() {
	return unsupported();
}
async function channelsCapabilitiesCommand() {
	return unsupported();
}
async function channelsRemoveCommand() {
	return unsupported();
}
//#endregion
//#region src/cli/channel-auth.ts
async function resolveChannelPluginForMode(opts, mode, cfg) {
	const explicitChannel = opts.channel?.trim();
	const channelInput = explicitChannel ? explicitChannel : (await resolveMessageChannelSelection({ cfg })).channel;
	const channelId = normalizeChannelId(channelInput);
	if (!channelId) throw new Error(`Unsupported channel: ${channelInput}`);
	const plugin = getChannelPlugin(channelId);
	if (!(mode === "login" ? Boolean(plugin?.auth?.login) : Boolean(plugin?.gateway?.logoutAccount))) throw new Error(`Channel ${channelId} does not support ${mode}`);
	return {
		channelInput,
		channelId,
		plugin
	};
}
function resolveAccountContext(plugin, opts, cfg) {
	return { accountId: opts.account?.trim() || resolveChannelDefaultAccountId({
		plugin,
		cfg
	}) };
}
async function runChannelLogin(opts, runtime = defaultRuntime) {
	const cfg = loadConfig();
	const { channelInput, plugin } = await resolveChannelPluginForMode(opts, "login", cfg);
	const login = plugin.auth?.login;
	if (!login) throw new Error(`Channel ${channelInput} does not support login`);
	setVerbose(Boolean(opts.verbose));
	const { accountId } = resolveAccountContext(plugin, opts, cfg);
	await login({
		cfg,
		accountId,
		runtime,
		verbose: Boolean(opts.verbose),
		channelInput
	});
}
async function runChannelLogout(opts, runtime = defaultRuntime) {
	const cfg = loadConfig();
	const { channelInput, plugin } = await resolveChannelPluginForMode(opts, "logout", cfg);
	const logoutAccount = plugin.gateway?.logoutAccount;
	if (!logoutAccount) throw new Error(`Channel ${channelInput} does not support logout`);
	const { accountId } = resolveAccountContext(plugin, opts, cfg);
	await logoutAccount({
		cfg,
		accountId,
		account: plugin.config.resolveAccount(cfg, accountId),
		runtime
	});
}
//#endregion
//#region src/cli/channels-cli.ts
const optionNamesAdd = [
	"channel",
	"account",
	"name",
	"token",
	"tokenFile",
	"botToken",
	"appToken",
	"signalNumber",
	"cliPath",
	"dbPath",
	"service",
	"region",
	"authDir",
	"httpUrl",
	"httpHost",
	"httpPort",
	"webhookPath",
	"webhookUrl",
	"audienceType",
	"audience",
	"useEnv",
	"homeserver",
	"userId",
	"accessToken",
	"password",
	"deviceName",
	"initialSyncLimit",
	"ship",
	"url",
	"code",
	"groupChannels",
	"dmAllowlist",
	"autoDiscoverChannels"
];
const optionNamesRemove = [
	"channel",
	"account",
	"delete"
];
function runChannelsCommand(action) {
	return runCommandWithRuntime(defaultRuntime, action);
}
function runChannelsCommandWithDanger(action, label) {
	return runCommandWithRuntime(defaultRuntime, action, (err) => {
		defaultRuntime.error(danger(`${label}: ${String(err)}`));
		defaultRuntime.exit(1);
	});
}
function registerChannelsCli(program) {
	const channelNames = formatCliChannelOptions();
	const channels = program.command("channels").description("Manage connected chat channels and accounts").addHelpText("after", () => `\n${theme.heading("Examples:")}\n${formatHelpExamples([
		["openclaw channels list", "List configured channels and auth profiles."],
		["openclaw channels status --probe", "Run channel status checks and probes."],
		["openclaw channels add --channel telegram --token <token>", "Add or update a channel account non-interactively."],
		["openclaw channels login --channel whatsapp", "Link a WhatsApp Web account."]
	])}\n\n${theme.muted("Docs:")} ${formatDocsLink("/cli/channels", "docs.openclaw.ai/cli/channels")}\n`);
	channels.command("list").description("List configured channels + auth profiles").option("--no-usage", "Skip model provider usage/quota snapshots").option("--json", "Output JSON", false).action(async (opts) => {
		await runChannelsCommand(async () => {
			await channelsListCommand(opts, defaultRuntime);
		});
	});
	channels.command("status").description("Show gateway channel status (use status --deep for local)").option("--probe", "Probe channel credentials", false).option("--timeout <ms>", "Timeout in ms", "10000").option("--json", "Output JSON", false).action(async (opts) => {
		await runChannelsCommand(async () => {
			await channelsStatusCommand(opts, defaultRuntime);
		});
	});
	channels.command("capabilities").description("Show provider capabilities (intents/scopes + supported features)").option("--channel <name>", `Channel (${formatCliChannelOptions(["all"])})`).option("--account <id>", "Account id (only with --channel)").option("--target <dest>", "Channel target for permission audit (Discord channel:<id>)").option("--timeout <ms>", "Timeout in ms", "10000").option("--json", "Output JSON", false).action(async (opts) => {
		await runChannelsCommand(async () => {
			await channelsCapabilitiesCommand(opts, defaultRuntime);
		});
	});
	channels.command("resolve").description("Resolve channel/user names to IDs").argument("<entries...>", "Entries to resolve (names or ids)").option("--channel <name>", `Channel (${channelNames})`).option("--account <id>", "Account id (accountId)").option("--kind <kind>", "Target kind (auto|user|group)", "auto").option("--json", "Output JSON", false).action(async (entries, opts) => {
		await runChannelsCommand(async () => {
			await channelsResolveCommand({
				channel: opts.channel,
				account: opts.account,
				kind: opts.kind,
				json: Boolean(opts.json),
				entries: Array.isArray(entries) ? entries : [String(entries)]
			}, defaultRuntime);
		});
	});
	channels.command("logs").description("Show recent channel logs from the gateway log file").option("--channel <name>", `Channel (${formatCliChannelOptions(["all"])})`, "all").option("--lines <n>", "Number of lines (default: 200)", "200").option("--json", "Output JSON", false).action(async (opts) => {
		await runChannelsCommand(async () => {
			await channelsLogsCommand(opts, defaultRuntime);
		});
	});
	channels.command("add").description("Add or update a channel account").option("--channel <name>", `Channel (${channelNames})`).option("--account <id>", "Account id (default when omitted)").option("--name <name>", "Display name for this account").option("--token <token>", "Bot token (Telegram/Discord)").option("--token-file <path>", "Bot token file (Telegram)").option("--bot-token <token>", "Slack bot token (xoxb-...)").option("--app-token <token>", "Slack app token (xapp-...)").option("--signal-number <e164>", "Signal account number (E.164)").option("--cli-path <path>", "CLI path (signal-cli or imsg)").option("--db-path <path>", "iMessage database path").option("--service <service>", "iMessage service (imessage|sms|auto)").option("--region <region>", "iMessage region (for SMS)").option("--auth-dir <path>", "WhatsApp auth directory override").option("--http-url <url>", "Signal HTTP daemon base URL").option("--http-host <host>", "Signal HTTP host").option("--http-port <port>", "Signal HTTP port").option("--webhook-path <path>", "Webhook path (Google Chat/BlueBubbles)").option("--webhook-url <url>", "Google Chat webhook URL").option("--audience-type <type>", "Google Chat audience type (app-url|project-number)").option("--audience <value>", "Google Chat audience value (app URL or project number)").option("--homeserver <url>", "Matrix homeserver URL").option("--user-id <id>", "Matrix user ID").option("--access-token <token>", "Matrix access token").option("--password <password>", "Matrix password").option("--device-name <name>", "Matrix device name").option("--initial-sync-limit <n>", "Matrix initial sync limit").option("--ship <ship>", "Tlon ship name (~sampel-palnet)").option("--url <url>", "Tlon ship URL").option("--code <code>", "Tlon login code").option("--group-channels <list>", "Tlon group channels (comma-separated)").option("--dm-allowlist <list>", "Tlon DM allowlist (comma-separated ships)").option("--auto-discover-channels", "Tlon auto-discover group channels").option("--no-auto-discover-channels", "Disable Tlon auto-discovery").option("--use-env", "Use env token (default account only)", false).action(async (opts, command) => {
		await runChannelsCommand(async () => {
			await channelsAddCommand(opts, defaultRuntime, { hasFlags: hasExplicitOptions(command, optionNamesAdd) });
		});
	});
	channels.command("remove").description("Disable or delete a channel account").option("--channel <name>", `Channel (${channelNames})`).option("--account <id>", "Account id (default when omitted)").option("--delete", "Delete config entries (no prompt)", false).action(async (opts, command) => {
		await runChannelsCommand(async () => {
			await channelsRemoveCommand(opts, defaultRuntime, { hasFlags: hasExplicitOptions(command, optionNamesRemove) });
		});
	});
	channels.command("login").description("Link a channel account (if supported)").option("--channel <channel>", "Channel alias (auto when only one is configured)").option("--account <id>", "Account id (accountId)").option("--verbose", "Verbose connection logs", false).action(async (opts) => {
		await runChannelsCommandWithDanger(async () => {
			await runChannelLogin({
				channel: opts.channel,
				account: opts.account,
				verbose: Boolean(opts.verbose)
			}, defaultRuntime);
		}, "Channel login failed");
	});
	channels.command("logout").description("Log out of a channel session (if supported)").option("--channel <channel>", "Channel alias (auto when only one is configured)").option("--account <id>", "Account id (accountId)").action(async (opts) => {
		await runChannelsCommandWithDanger(async () => {
			await runChannelLogout({
				channel: opts.channel,
				account: opts.account
			}, defaultRuntime);
		}, "Channel logout failed");
	});
}
//#endregion
export { registerChannelsCli };
