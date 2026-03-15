import { t as createSubsystemLogger } from "./subsystem-C5Ov5Tl6.js";
import { Ks as createPluginLoaderLogger, Xu as getChannelPlugin, Zu as listChannelPlugins, ed as resolveChannelDefaultAccountId, on as listChannelPluginCatalogEntries, rn as isChannelConfigured, wt as loadOpenClawPlugins } from "./reply-BJBzAldK.js";
import { d as resolveAgentWorkspaceDir, f as resolveDefaultAgentId } from "./agent-scope-mSwAEzsR.js";
import { g as normalizeAccountId, h as DEFAULT_ACCOUNT_ID } from "./session-key-COcqKA5t.js";
import { t as formatCliCommand } from "./command-format-CEAcyghQ.js";
import { M as formatChannelSelectionLine, P as listChatChannels, g as clearPluginDiscoveryCache, j as formatChannelPrimerLine } from "./skills-yYj6k7r6.js";
import { t as formatDocsLink } from "./links-CQdKVoyv.js";
import { t as discordOnboardingAdapter } from "./discord-CAhJtFnS.js";
import { c as findBundledPluginSourceInMap, i as installPluginFromNpmSpec, l as resolveBundledPluginSources, n as recordPluginInstall, t as buildNpmResolutionInstallFields } from "./installs-CSEFIBrW.js";
import { t as enablePluginInConfig } from "./enable-BwZyXKjJ.js";
import { n as resolveBundledInstallPlanForCatalogEntry } from "./plugin-install-plan-QK9qdju2.js";
import fs from "node:fs";
import path from "node:path";
//#region src/commands/onboarding/plugin-install.ts
function hasGitWorkspace(workspaceDir) {
	const candidates = /* @__PURE__ */ new Set();
	candidates.add(path.join(process.cwd(), ".git"));
	if (workspaceDir && workspaceDir !== process.cwd()) candidates.add(path.join(workspaceDir, ".git"));
	for (const candidate of candidates) if (fs.existsSync(candidate)) return true;
	return false;
}
function resolveLocalPath(entry, workspaceDir, allowLocal) {
	if (!allowLocal) return null;
	const raw = entry.install.localPath?.trim();
	if (!raw) return null;
	const candidates = /* @__PURE__ */ new Set();
	candidates.add(path.resolve(process.cwd(), raw));
	if (workspaceDir && workspaceDir !== process.cwd()) candidates.add(path.resolve(workspaceDir, raw));
	for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
	return null;
}
function addPluginLoadPath(cfg, pluginPath) {
	const existing = cfg.plugins?.load?.paths ?? [];
	const merged = Array.from(new Set([...existing, pluginPath]));
	return {
		...cfg,
		plugins: {
			...cfg.plugins,
			load: {
				...cfg.plugins?.load,
				paths: merged
			}
		}
	};
}
async function promptInstallChoice(params) {
	const { entry, localPath, prompter, defaultChoice } = params;
	const localOptions = localPath ? [{
		value: "local",
		label: "Use local plugin path",
		hint: localPath
	}] : [];
	const options = [
		{
			value: "npm",
			label: `Download from npm (${entry.install.npmSpec})`
		},
		...localOptions,
		{
			value: "skip",
			label: "Skip for now"
		}
	];
	const initialValue = defaultChoice === "local" && !localPath ? "npm" : defaultChoice;
	return await prompter.select({
		message: `Install ${entry.meta.label} plugin?`,
		options,
		initialValue
	});
}
function resolveInstallDefaultChoice(params) {
	const { cfg, entry, localPath, bundledLocalPath } = params;
	if (bundledLocalPath) return "local";
	const updateChannel = cfg.update?.channel;
	if (updateChannel === "dev") return localPath ? "local" : "npm";
	if (updateChannel === "stable" || updateChannel === "beta") return "npm";
	const entryDefault = entry.install.defaultChoice;
	if (entryDefault === "local") return localPath ? "local" : "npm";
	if (entryDefault === "npm") return "npm";
	return localPath ? "local" : "npm";
}
async function ensureOnboardingPluginInstalled(params) {
	const { entry, prompter, runtime, workspaceDir } = params;
	let next = params.cfg;
	const allowLocal = hasGitWorkspace(workspaceDir);
	const bundledSources = resolveBundledPluginSources({ workspaceDir });
	const bundledLocalPath = resolveBundledInstallPlanForCatalogEntry({
		pluginId: entry.id,
		npmSpec: entry.install.npmSpec,
		findBundledSource: (lookup) => findBundledPluginSourceInMap({
			bundled: bundledSources,
			lookup
		})
	})?.bundledSource.localPath ?? null;
	const localPath = bundledLocalPath ?? resolveLocalPath(entry, workspaceDir, allowLocal);
	const choice = await promptInstallChoice({
		entry,
		localPath,
		defaultChoice: resolveInstallDefaultChoice({
			cfg: next,
			entry,
			localPath,
			bundledLocalPath
		}),
		prompter
	});
	if (choice === "skip") return {
		cfg: next,
		installed: false
	};
	if (choice === "local" && localPath) {
		next = addPluginLoadPath(next, localPath);
		next = enablePluginInConfig(next, entry.id).config;
		return {
			cfg: next,
			installed: true
		};
	}
	const result = await installPluginFromNpmSpec({
		spec: entry.install.npmSpec,
		logger: {
			info: (msg) => runtime.log?.(msg),
			warn: (msg) => runtime.log?.(msg)
		}
	});
	if (result.ok) {
		next = enablePluginInConfig(next, result.pluginId).config;
		next = recordPluginInstall(next, {
			pluginId: result.pluginId,
			source: "npm",
			spec: entry.install.npmSpec,
			installPath: result.targetDir,
			version: result.version,
			...buildNpmResolutionInstallFields(result.npmResolution)
		});
		return {
			cfg: next,
			installed: true
		};
	}
	await prompter.note(`Failed to install ${entry.install.npmSpec}: ${result.error}`, "Plugin install");
	if (localPath) {
		if (await prompter.confirm({
			message: `Use local plugin path instead? (${localPath})`,
			initialValue: true
		})) {
			next = addPluginLoadPath(next, localPath);
			next = enablePluginInConfig(next, entry.id).config;
			return {
				cfg: next,
				installed: true
			};
		}
	}
	runtime.error?.(`Plugin install failed: ${result.error}`);
	return {
		cfg: next,
		installed: false
	};
}
function reloadOnboardingPluginRegistry(params) {
	clearPluginDiscoveryCache();
	const workspaceDir = params.workspaceDir ?? resolveAgentWorkspaceDir(params.cfg, resolveDefaultAgentId(params.cfg));
	const log = createSubsystemLogger("plugins");
	loadOpenClawPlugins({
		config: params.cfg,
		workspaceDir,
		cache: false,
		logger: createPluginLoaderLogger(log)
	});
}
//#endregion
//#region src/channels/plugins/onboarding/imessage.ts
const channel$4 = "imessage";
const imessageOnboardingAdapter = {
	channel: channel$4,
	getStatus: async () => ({
		channel: channel$4,
		configured: false,
		statusLines: ["iMessage: unavailable in this trimmed build"],
		selectionHint: "disabled in trimmed build",
		quickstartScore: 0
	}),
	configure: async ({ cfg, prompter }) => {
		await prompter.note("iMessage onboarding is unavailable in this trimmed build.", "iMessage");
		return { cfg };
	},
	disable: (cfg) => cfg
};
//#endregion
//#region src/channels/plugins/onboarding/signal.ts
const channel$3 = "signal";
const signalOnboardingAdapter = {
	channel: channel$3,
	getStatus: async () => ({
		channel: channel$3,
		configured: false,
		statusLines: ["Signal: unavailable in this trimmed build"],
		selectionHint: "disabled in trimmed build",
		quickstartScore: 0
	}),
	configure: async ({ cfg, prompter }) => {
		await prompter.note("Signal onboarding is unavailable in this trimmed build.", "Signal");
		return { cfg };
	},
	disable: (cfg) => cfg
};
//#endregion
//#region src/channels/plugins/onboarding/slack.ts
const channel$2 = "slack";
function buildUnavailableStatus$2(_ctx) {
	return {
		channel: channel$2,
		configured: false,
		statusLines: ["Slack: unavailable in this trimmed build"],
		selectionHint: "disabled in trimmed build",
		quickstartScore: 0
	};
}
const slackOnboardingAdapter = {
	channel: channel$2,
	getStatus: async (ctx) => buildUnavailableStatus$2(ctx),
	configure: async ({ cfg, prompter }) => {
		await prompter.note("Slack onboarding is unavailable in this trimmed build.", "Slack");
		return { cfg };
	},
	disable: (cfg) => cfg
};
//#endregion
//#region src/channels/plugins/onboarding/telegram.ts
const channel$1 = "telegram";
function buildUnavailableStatus$1(_cfg) {
	return {
		channel: channel$1,
		configured: false,
		statusLines: ["Telegram: unavailable in this trimmed build"],
		selectionHint: "disabled in trimmed build",
		quickstartScore: 0
	};
}
const telegramOnboardingAdapter = {
	channel: channel$1,
	getStatus: async ({ cfg }) => buildUnavailableStatus$1(cfg),
	configure: async ({ cfg, prompter }) => {
		await prompter.note("Telegram onboarding is unavailable in this trimmed build.", "Telegram unavailable");
		return { cfg };
	},
	disable: (cfg) => cfg
};
//#endregion
//#region src/channels/plugins/onboarding/whatsapp.ts
const channel = "whatsapp";
function buildUnavailableStatus(_cfg) {
	return {
		channel,
		configured: false,
		statusLines: ["WhatsApp onboarding: unavailable in this trimmed build"],
		selectionHint: "disabled in trimmed build",
		quickstartScore: 0
	};
}
//#endregion
//#region src/commands/onboarding/registry.ts
const BUILTIN_ONBOARDING_ADAPTERS = [
	telegramOnboardingAdapter,
	{
		channel,
		getStatus: async ({ cfg }) => buildUnavailableStatus(cfg),
		configure: async ({ cfg, prompter }) => {
			await prompter.note("WhatsApp onboarding is unavailable in this trimmed build.", "WhatsApp unavailable");
			return { cfg };
		},
		disable: (cfg) => cfg
	},
	discordOnboardingAdapter,
	slackOnboardingAdapter,
	signalOnboardingAdapter,
	imessageOnboardingAdapter
];
const CHANNEL_ONBOARDING_ADAPTERS = () => {
	const fromRegistry = listChannelPlugins().map((plugin) => plugin.onboarding ? [plugin.id, plugin.onboarding] : null).filter((entry) => Boolean(entry));
	const fromBuiltins = BUILTIN_ONBOARDING_ADAPTERS.map((adapter) => [adapter.channel, adapter]);
	return new Map([...fromBuiltins, ...fromRegistry]);
};
function getChannelOnboardingAdapter(channel) {
	return CHANNEL_ONBOARDING_ADAPTERS().get(channel);
}
function listChannelOnboardingAdapters() {
	return Array.from(CHANNEL_ONBOARDING_ADAPTERS().values());
}
//#endregion
//#region src/commands/onboard-channels.ts
function formatAccountLabel(accountId) {
	return accountId === "default" ? "default (primary)" : accountId;
}
async function promptConfiguredAction(params) {
	const { prompter, label, supportsDisable, supportsDelete } = params;
	const updateOption = {
		value: "update",
		label: "Modify settings"
	};
	const disableOption = {
		value: "disable",
		label: "Disable (keeps config)"
	};
	const deleteOption = {
		value: "delete",
		label: "Delete config"
	};
	const skipOption = {
		value: "skip",
		label: "Skip (leave as-is)"
	};
	const options = [
		updateOption,
		...supportsDisable ? [disableOption] : [],
		...supportsDelete ? [deleteOption] : [],
		skipOption
	];
	return await prompter.select({
		message: `${label} already configured. What do you want to do?`,
		options,
		initialValue: "update"
	});
}
async function promptRemovalAccountId(params) {
	const { cfg, prompter, label, channel } = params;
	const plugin = getChannelPlugin(channel);
	if (!plugin) return DEFAULT_ACCOUNT_ID;
	const accountIds = plugin.config.listAccountIds(cfg).filter(Boolean);
	const defaultAccountId = resolveChannelDefaultAccountId({
		plugin,
		cfg,
		accountIds
	});
	if (accountIds.length <= 1) return defaultAccountId;
	return normalizeAccountId(await prompter.select({
		message: `${label} account`,
		options: accountIds.map((accountId) => ({
			value: accountId,
			label: formatAccountLabel(accountId)
		})),
		initialValue: defaultAccountId
	})) ?? defaultAccountId;
}
async function collectChannelStatus(params) {
	const installedPlugins = listChannelPlugins();
	const installedIds = new Set(installedPlugins.map((plugin) => plugin.id));
	const catalogEntries = listChannelPluginCatalogEntries({ workspaceDir: resolveAgentWorkspaceDir(params.cfg, resolveDefaultAgentId(params.cfg)) }).filter((entry) => !installedIds.has(entry.id));
	const statusEntries = await Promise.all(listChannelOnboardingAdapters().map((adapter) => adapter.getStatus({
		cfg: params.cfg,
		options: params.options,
		accountOverrides: params.accountOverrides
	})));
	const statusByChannel = new Map(statusEntries.map((entry) => [entry.channel, entry]));
	const fallbackStatuses = listChatChannels().filter((meta) => !statusByChannel.has(meta.id)).map((meta) => {
		const configured = isChannelConfigured(params.cfg, meta.id);
		const statusLabel = configured ? "configured (plugin disabled)" : "not configured";
		return {
			channel: meta.id,
			configured,
			statusLines: [`${meta.label}: ${statusLabel}`],
			selectionHint: configured ? "configured · plugin disabled" : "not configured",
			quickstartScore: 0
		};
	});
	const catalogStatuses = catalogEntries.map((entry) => ({
		channel: entry.id,
		configured: false,
		statusLines: [`${entry.meta.label}: install plugin to enable`],
		selectionHint: "plugin · install",
		quickstartScore: 0
	}));
	const combinedStatuses = [
		...statusEntries,
		...fallbackStatuses,
		...catalogStatuses
	];
	return {
		installedPlugins,
		catalogEntries,
		statusByChannel: new Map(combinedStatuses.map((entry) => [entry.channel, entry])),
		statusLines: combinedStatuses.flatMap((entry) => entry.statusLines)
	};
}
async function noteChannelStatus(params) {
	const { statusLines } = await collectChannelStatus({
		cfg: params.cfg,
		options: params.options,
		accountOverrides: params.accountOverrides ?? {}
	});
	if (statusLines.length > 0) await params.prompter.note(statusLines.join("\n"), "Channel status");
}
async function noteChannelPrimer(prompter, channels) {
	const channelLines = channels.map((channel) => formatChannelPrimerLine({
		id: channel.id,
		label: channel.label,
		selectionLabel: channel.label,
		docsPath: "/",
		blurb: channel.blurb
	}));
	await prompter.note([
		"DM security: default is pairing; unknown DMs get a pairing code.",
		`Approve with: ${formatCliCommand("openclaw pairing approve <channel> <code>")}`,
		"Public DMs require dmPolicy=\"open\" + allowFrom=[\"*\"].",
		"Multi-user DMs: run: " + formatCliCommand("openclaw config set session.dmScope \"per-channel-peer\"") + " (or \"per-account-channel-peer\" for multi-account channels) to isolate sessions.",
		`Docs: ${formatDocsLink("/channels/pairing", "channels/pairing")}`,
		"",
		...channelLines
	].join("\n"), "How channels work");
}
function resolveQuickstartDefault(statusByChannel) {
	let best = null;
	for (const [channel, status] of statusByChannel) {
		if (status.quickstartScore == null) continue;
		if (!best || status.quickstartScore > best.score) best = {
			channel,
			score: status.quickstartScore
		};
	}
	return best?.channel;
}
async function maybeConfigureDmPolicies(params) {
	const { selection, prompter, accountIdsByChannel } = params;
	const dmPolicies = selection.map((channel) => getChannelOnboardingAdapter(channel)?.dmPolicy).filter(Boolean);
	if (dmPolicies.length === 0) return params.cfg;
	if (!await prompter.confirm({
		message: "Configure DM access policies now? (default: pairing)",
		initialValue: false
	})) return params.cfg;
	let cfg = params.cfg;
	const selectPolicy = async (policy) => {
		await prompter.note([
			"Default: pairing (unknown DMs get a pairing code).",
			`Approve: ${formatCliCommand(`openclaw pairing approve ${policy.channel} <code>`)}`,
			`Allowlist DMs: ${policy.policyKey}="allowlist" + ${policy.allowFromKey} entries.`,
			`Public DMs: ${policy.policyKey}="open" + ${policy.allowFromKey} includes "*".`,
			"Multi-user DMs: run: " + formatCliCommand("openclaw config set session.dmScope \"per-channel-peer\"") + " (or \"per-account-channel-peer\" for multi-account channels) to isolate sessions.",
			`Docs: ${formatDocsLink("/channels/pairing", "channels/pairing")}`
		].join("\n"), `${policy.label} DM access`);
		return await prompter.select({
			message: `${policy.label} DM policy`,
			options: [
				{
					value: "pairing",
					label: "Pairing (recommended)"
				},
				{
					value: "allowlist",
					label: "Allowlist (specific users only)"
				},
				{
					value: "open",
					label: "Open (public inbound DMs)"
				},
				{
					value: "disabled",
					label: "Disabled (ignore DMs)"
				}
			]
		});
	};
	for (const policy of dmPolicies) {
		const current = policy.getCurrent(cfg);
		const nextPolicy = await selectPolicy(policy);
		if (nextPolicy !== current) cfg = policy.setPolicy(cfg, nextPolicy);
		if (nextPolicy === "allowlist" && policy.promptAllowFrom) cfg = await policy.promptAllowFrom({
			cfg,
			prompter,
			accountId: accountIdsByChannel?.get(policy.channel)
		});
	}
	return cfg;
}
async function setupChannels(cfg, runtime, prompter, options) {
	let next = cfg;
	const forceAllowFromChannels = new Set(options?.forceAllowFromChannels ?? []);
	const accountOverrides = { ...options?.accountIds };
	if (options?.whatsappAccountId?.trim()) accountOverrides.whatsapp = options.whatsappAccountId.trim();
	const { installedPlugins, catalogEntries, statusByChannel, statusLines } = await collectChannelStatus({
		cfg: next,
		options,
		accountOverrides
	});
	if (!options?.skipStatusNote && statusLines.length > 0) await prompter.note(statusLines.join("\n"), "Channel status");
	if (!(options?.skipConfirm ? true : await prompter.confirm({
		message: "Configure chat channels now?",
		initialValue: true
	}))) return cfg;
	const corePrimer = listChatChannels().map((meta) => ({
		id: meta.id,
		label: meta.label,
		blurb: meta.blurb
	}));
	const coreIds = new Set(corePrimer.map((entry) => entry.id));
	await noteChannelPrimer(prompter, [
		...corePrimer,
		...installedPlugins.filter((plugin) => !coreIds.has(plugin.id)).map((plugin) => ({
			id: plugin.id,
			label: plugin.meta.label,
			blurb: plugin.meta.blurb
		})),
		...catalogEntries.filter((entry) => !coreIds.has(entry.id)).map((entry) => ({
			id: entry.id,
			label: entry.meta.label,
			blurb: entry.meta.blurb
		}))
	]);
	const quickstartDefault = options?.initialSelection?.[0] ?? resolveQuickstartDefault(statusByChannel);
	const shouldPromptAccountIds = options?.promptAccountIds === true;
	const accountIdsByChannel = /* @__PURE__ */ new Map();
	const recordAccount = (channel, accountId) => {
		options?.onAccountId?.(channel, accountId);
		getChannelOnboardingAdapter(channel)?.onAccountRecorded?.(accountId, options);
		accountIdsByChannel.set(channel, accountId);
	};
	const selection = [];
	const addSelection = (channel) => {
		if (!selection.includes(channel)) selection.push(channel);
	};
	const resolveDisabledHint = (channel) => {
		const plugin = getChannelPlugin(channel);
		if (!plugin) {
			if (next.plugins?.entries?.[channel]?.enabled === false) return "plugin disabled";
			if (next.plugins?.enabled === false) return "plugins disabled";
			return;
		}
		const accountId = resolveChannelDefaultAccountId({
			plugin,
			cfg: next
		});
		const account = plugin.config.resolveAccount(next, accountId);
		let enabled;
		if (plugin.config.isEnabled) enabled = plugin.config.isEnabled(account, next);
		else if (typeof account?.enabled === "boolean") enabled = account.enabled;
		else if (typeof next.channels?.[channel]?.enabled === "boolean") enabled = next.channels[channel]?.enabled;
		return enabled === false ? "disabled" : void 0;
	};
	const buildSelectionOptions = (entries) => entries.map((entry) => {
		const status = statusByChannel.get(entry.id);
		const disabledHint = resolveDisabledHint(entry.id);
		const hint = [status?.selectionHint, disabledHint].filter(Boolean).join(" · ") || void 0;
		return {
			value: entry.meta.id,
			label: entry.meta.selectionLabel ?? entry.meta.label,
			...hint ? { hint } : {}
		};
	});
	const getChannelEntries = () => {
		const core = listChatChannels();
		const installed = listChannelPlugins();
		const installedIds = new Set(installed.map((plugin) => plugin.id));
		const catalog = listChannelPluginCatalogEntries({ workspaceDir: resolveAgentWorkspaceDir(next, resolveDefaultAgentId(next)) }).filter((entry) => !installedIds.has(entry.id));
		const metaById = /* @__PURE__ */ new Map();
		for (const meta of core) metaById.set(meta.id, meta);
		for (const plugin of installed) metaById.set(plugin.id, plugin.meta);
		for (const entry of catalog) if (!metaById.has(entry.id)) metaById.set(entry.id, entry.meta);
		return {
			entries: Array.from(metaById, ([id, meta]) => ({
				id,
				meta
			})),
			catalog,
			catalogById: new Map(catalog.map((entry) => [entry.id, entry]))
		};
	};
	const refreshStatus = async (channel) => {
		const adapter = getChannelOnboardingAdapter(channel);
		if (!adapter) return;
		const status = await adapter.getStatus({
			cfg: next,
			options,
			accountOverrides
		});
		statusByChannel.set(channel, status);
	};
	const ensureBundledPluginEnabled = async (channel) => {
		if (getChannelPlugin(channel)) return true;
		const result = enablePluginInConfig(next, channel);
		next = result.config;
		if (!result.enabled) {
			await prompter.note(`Cannot enable ${channel}: ${result.reason ?? "plugin disabled"}.`, "Channel setup");
			return false;
		}
		const workspaceDir = resolveAgentWorkspaceDir(next, resolveDefaultAgentId(next));
		reloadOnboardingPluginRegistry({
			cfg: next,
			runtime,
			workspaceDir
		});
		if (!getChannelPlugin(channel)) {
			if (getChannelOnboardingAdapter(channel)) {
				await prompter.note(`${channel} plugin not available (continuing with onboarding). If the channel still doesn't work after setup, run \`${formatCliCommand("openclaw plugins list")}\` and \`${formatCliCommand("openclaw plugins enable " + channel)}\`, then restart the gateway.`, "Channel setup");
				await refreshStatus(channel);
				return true;
			}
			await prompter.note(`${channel} plugin not available.`, "Channel setup");
			return false;
		}
		await refreshStatus(channel);
		return true;
	};
	const applyOnboardingResult = async (channel, result) => {
		next = result.cfg;
		if (result.accountId) recordAccount(channel, result.accountId);
		addSelection(channel);
		await refreshStatus(channel);
	};
	const applyCustomOnboardingResult = async (channel, result) => {
		if (result === "skip") return false;
		await applyOnboardingResult(channel, result);
		return true;
	};
	const configureChannel = async (channel) => {
		const adapter = getChannelOnboardingAdapter(channel);
		if (!adapter) {
			await prompter.note(`${channel} does not support onboarding yet.`, "Channel setup");
			return;
		}
		await applyOnboardingResult(channel, await adapter.configure({
			cfg: next,
			runtime,
			prompter,
			options,
			accountOverrides,
			shouldPromptAccountIds,
			forceAllowFrom: forceAllowFromChannels.has(channel)
		}));
	};
	const handleConfiguredChannel = async (channel, label) => {
		const plugin = getChannelPlugin(channel);
		const adapter = getChannelOnboardingAdapter(channel);
		if (adapter?.configureWhenConfigured) {
			if (!await applyCustomOnboardingResult(channel, await adapter.configureWhenConfigured({
				cfg: next,
				runtime,
				prompter,
				options,
				accountOverrides,
				shouldPromptAccountIds,
				forceAllowFrom: forceAllowFromChannels.has(channel),
				configured: true,
				label
			}))) return;
			return;
		}
		const supportsDisable = Boolean(options?.allowDisable && (plugin?.config.setAccountEnabled || adapter?.disable));
		const supportsDelete = Boolean(options?.allowDisable && plugin?.config.deleteAccount);
		const action = await promptConfiguredAction({
			prompter,
			label,
			supportsDisable,
			supportsDelete
		});
		if (action === "skip") return;
		if (action === "update") {
			await configureChannel(channel);
			return;
		}
		if (!options?.allowDisable) return;
		if (action === "delete" && !supportsDelete) {
			await prompter.note(`${label} does not support deleting config entries.`, "Remove channel");
			return;
		}
		const resolvedAccountId = normalizeAccountId((action === "delete" ? Boolean(plugin?.config.deleteAccount) : Boolean(plugin?.config.setAccountEnabled)) ? await promptRemovalAccountId({
			cfg: next,
			prompter,
			label,
			channel
		}) : "default") ?? (plugin ? resolveChannelDefaultAccountId({
			plugin,
			cfg: next
		}) : "default");
		const accountLabel = formatAccountLabel(resolvedAccountId);
		if (action === "delete") {
			if (!await prompter.confirm({
				message: `Delete ${label} account "${accountLabel}"?`,
				initialValue: false
			})) return;
			if (plugin?.config.deleteAccount) next = plugin.config.deleteAccount({
				cfg: next,
				accountId: resolvedAccountId
			});
			await refreshStatus(channel);
			return;
		}
		if (plugin?.config.setAccountEnabled) next = plugin.config.setAccountEnabled({
			cfg: next,
			accountId: resolvedAccountId,
			enabled: false
		});
		else if (adapter?.disable) next = adapter.disable(next);
		await refreshStatus(channel);
	};
	const handleChannelChoice = async (channel) => {
		const { catalogById } = getChannelEntries();
		const catalogEntry = catalogById.get(channel);
		if (catalogEntry) {
			const workspaceDir = resolveAgentWorkspaceDir(next, resolveDefaultAgentId(next));
			const result = await ensureOnboardingPluginInstalled({
				cfg: next,
				entry: catalogEntry,
				prompter,
				runtime,
				workspaceDir
			});
			next = result.cfg;
			if (!result.installed) return;
			reloadOnboardingPluginRegistry({
				cfg: next,
				runtime,
				workspaceDir
			});
			await refreshStatus(channel);
		} else if (!await ensureBundledPluginEnabled(channel)) return;
		const plugin = getChannelPlugin(channel);
		const adapter = getChannelOnboardingAdapter(channel);
		const label = plugin?.meta.label ?? catalogEntry?.meta.label ?? channel;
		const configured = statusByChannel.get(channel)?.configured ?? false;
		if (adapter?.configureInteractive) {
			if (!await applyCustomOnboardingResult(channel, await adapter.configureInteractive({
				cfg: next,
				runtime,
				prompter,
				options,
				accountOverrides,
				shouldPromptAccountIds,
				forceAllowFrom: forceAllowFromChannels.has(channel),
				configured,
				label
			}))) return;
			return;
		}
		if (configured) {
			await handleConfiguredChannel(channel, label);
			return;
		}
		await configureChannel(channel);
	};
	if (options?.quickstartDefaults) {
		const { entries } = getChannelEntries();
		const choice = await prompter.select({
			message: "Select channel (QuickStart)",
			options: [...buildSelectionOptions(entries), {
				value: "__skip__",
				label: "Skip for now",
				hint: `You can add channels later via \`${formatCliCommand("openclaw channels add")}\``
			}],
			initialValue: quickstartDefault
		});
		if (choice !== "__skip__") await handleChannelChoice(choice);
	} else {
		const doneValue = "__done__";
		const initialValue = options?.initialSelection?.[0] ?? quickstartDefault;
		while (true) {
			const { entries } = getChannelEntries();
			const choice = await prompter.select({
				message: "Select a channel",
				options: [...buildSelectionOptions(entries), {
					value: doneValue,
					label: "Finished",
					hint: selection.length > 0 ? "Done" : "Skip for now"
				}],
				initialValue
			});
			if (choice === doneValue) break;
			await handleChannelChoice(choice);
		}
	}
	options?.onSelection?.(selection);
	const selectionNotes = /* @__PURE__ */ new Map();
	const { entries: selectionEntries } = getChannelEntries();
	for (const entry of selectionEntries) selectionNotes.set(entry.id, formatChannelSelectionLine(entry.meta, formatDocsLink));
	const selectedLines = selection.map((channel) => selectionNotes.get(channel)).filter((line) => Boolean(line));
	if (selectedLines.length > 0) await prompter.note(selectedLines.join("\n"), "Selected channels");
	if (!options?.skipDmPolicyPrompt) next = await maybeConfigureDmPolicies({
		cfg: next,
		selection,
		prompter,
		accountIdsByChannel
	});
	return next;
}
//#endregion
export { setupChannels as n, noteChannelStatus as t };
