import { f as defaultRuntime } from "./subsystem-C1ZwgyXv.js";
import "./paths-dQ_clcF4.js";
import "./boolean-BHdNsbzF.js";
import { Fn as listRouteBindings, Pn as isRouteBinding, _u as normalizeChannelId, gu as listChannelPlugins, hu as getChannelPlugin, jp as writeConfigFile, m as ensureAuthProfileStore, y as resolveAuthStorePath, yu as resolveChannelDefaultAccountId } from "./auth-profiles-DZ4zIQH4.js";
import { t as formatCliCommand } from "./command-format-CO3N-oGG.js";
import { a as resolveAgentDir, d as resolveAgentWorkspaceDir, f as resolveDefaultAgentId, n as listAgentEntries } from "./agent-scope-lHks6gb9.js";
import { h as DEFAULT_ACCOUNT_ID, s as normalizeAgentId, t as DEFAULT_AGENT_ID } from "./session-key-9lbhEIb9.js";
import { _ as shortenHomePath, h as resolveUserPath } from "./utils-D0Yqqtk-.js";
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
import { c as resolveSessionTranscriptsDirForAgent } from "./paths-CmL1n6G7.js";
import "./session-cost-usage-Zj7Y3VA9.js";
import "./links-BmJbo-zG.js";
import "./cli-utils-Cc7goTOv.js";
import "./provider-env-vars-CUqWnuWU.js";
import "./issue-format-C8GXLHk1.js";
import { t as requireValidConfigSnapshot } from "./config-validation-BaBpwqUg.js";
import { a as ensureWorkspaceAndSessions, l as moveToTrash } from "./onboard-helpers-4CUqO3j0.js";
import "./prompt-style-B3R7Bffy.js";
import { t as WizardCancelledError } from "./prompts-BrEAENsf.js";
import { a as pruneAgentConfig, c as parseIdentityMarkdown, i as loadAgentIdentity, n as buildAgentSummaries, o as identityHasValues, r as findAgentEntryIndex, t as applyAgentConfig } from "./agents.config-C28u20wN.js";
import "./skill-scanner-B6JKo5Zj.js";
import "./archive-nC1xtUAK.js";
import "./install-target-CJO4Zybf.js";
import "./provider-auth-helpers-CIILB8Ym.js";
import { n as logConfigUpdated } from "./logging-D3TCKWkc.js";
import "./openai-codex-oauth-BoDqUlFi.js";
import "./note-QL6AfaP7.js";
import { t as createClackPrompter } from "./clack-prompter-BsorKzB7.js";
import "./auth-token-Cjub2Rkc.js";
import "./oauth-tls-preflight-BtOhpKur.js";
import "./installs-BqV3H267.js";
import "./enable-B88Ork4A.js";
import "./plugin-install-plan-CyuhOAX5.js";
import "./provider-wizard-Di6BkcUS.js";
import "./auth-choice-options-DzHF1BVn.js";
import { n as promptAuthChoiceGrouped } from "./auth-choice-prompt-BPQ7963E.js";
import "./auth-choice.apply-helpers-CM2lPq_z.js";
import { n as warnIfModelConfigLooksOff, r as applyAuthChoice } from "./auth-choice-BEVaOqGl.js";
import "./auth-choice.preferred-provider-jkI_HH5W.js";
import "./model-picker-CrA5EoZa.js";
import { n as setupChannels } from "./onboard-channels-C5CP-SM6.js";
import path from "node:path";
import fs from "node:fs/promises";
//#region src/commands/agents.bindings.ts
function bindingMatchKey(match) {
	const accountId = match.accountId?.trim() || "default";
	return [bindingMatchIdentityKey(match), accountId].join("|");
}
function bindingMatchIdentityKey(match) {
	const roles = Array.isArray(match.roles) ? Array.from(new Set(match.roles.map((role) => role.trim()).filter(Boolean).toSorted())) : [];
	return [
		match.channel,
		match.peer?.kind ?? "",
		match.peer?.id ?? "",
		match.guildId ?? "",
		match.teamId ?? "",
		roles.join(",")
	].join("|");
}
function canUpgradeBindingAccountScope(params) {
	if (!params.incoming.match.accountId?.trim()) return false;
	if (params.existing.match.accountId?.trim()) return false;
	if (normalizeAgentId(params.existing.agentId) !== params.normalizedIncomingAgentId) return false;
	return bindingMatchIdentityKey(params.existing.match) === bindingMatchIdentityKey(params.incoming.match);
}
function describeBinding(binding) {
	const match = binding.match;
	const parts = [match.channel];
	if (match.accountId) parts.push(`accountId=${match.accountId}`);
	if (match.peer) parts.push(`peer=${match.peer.kind}:${match.peer.id}`);
	if (match.guildId) parts.push(`guild=${match.guildId}`);
	if (match.teamId) parts.push(`team=${match.teamId}`);
	return parts.join(" ");
}
function applyAgentBindings(cfg, bindings) {
	const existingRoutes = [...listRouteBindings(cfg)];
	const nonRouteBindings = (cfg.bindings ?? []).filter((binding) => !isRouteBinding(binding));
	const existingMatchMap = /* @__PURE__ */ new Map();
	for (const binding of existingRoutes) {
		const key = bindingMatchKey(binding.match);
		if (!existingMatchMap.has(key)) existingMatchMap.set(key, normalizeAgentId(binding.agentId));
	}
	const added = [];
	const updated = [];
	const skipped = [];
	const conflicts = [];
	for (const binding of bindings) {
		const agentId = normalizeAgentId(binding.agentId);
		const key = bindingMatchKey(binding.match);
		const existingAgentId = existingMatchMap.get(key);
		if (existingAgentId) {
			if (existingAgentId === agentId) skipped.push(binding);
			else conflicts.push({
				binding,
				existingAgentId
			});
			continue;
		}
		const upgradeIndex = existingRoutes.findIndex((candidate) => canUpgradeBindingAccountScope({
			existing: candidate,
			incoming: binding,
			normalizedIncomingAgentId: agentId
		}));
		if (upgradeIndex >= 0) {
			const current = existingRoutes[upgradeIndex];
			if (!current) continue;
			const previousKey = bindingMatchKey(current.match);
			const upgradedBinding = {
				...current,
				agentId,
				match: {
					...current.match,
					accountId: binding.match.accountId?.trim()
				}
			};
			existingRoutes[upgradeIndex] = upgradedBinding;
			existingMatchMap.delete(previousKey);
			existingMatchMap.set(bindingMatchKey(upgradedBinding.match), agentId);
			updated.push(upgradedBinding);
			continue;
		}
		existingMatchMap.set(key, agentId);
		added.push({
			...binding,
			agentId
		});
	}
	if (added.length === 0 && updated.length === 0) return {
		config: cfg,
		added,
		updated,
		skipped,
		conflicts
	};
	return {
		config: {
			...cfg,
			bindings: [
				...existingRoutes,
				...added,
				...nonRouteBindings
			]
		},
		added,
		updated,
		skipped,
		conflicts
	};
}
function removeAgentBindings(cfg, bindings) {
	const existingRoutes = listRouteBindings(cfg);
	const nonRouteBindings = (cfg.bindings ?? []).filter((binding) => !isRouteBinding(binding));
	const removeIndexes = /* @__PURE__ */ new Set();
	const removed = [];
	const missing = [];
	const conflicts = [];
	for (const binding of bindings) {
		const desiredAgentId = normalizeAgentId(binding.agentId);
		const key = bindingMatchKey(binding.match);
		let matchedIndex = -1;
		let conflictingAgentId = null;
		for (let i = 0; i < existingRoutes.length; i += 1) {
			if (removeIndexes.has(i)) continue;
			const current = existingRoutes[i];
			if (!current || bindingMatchKey(current.match) !== key) continue;
			const currentAgentId = normalizeAgentId(current.agentId);
			if (currentAgentId === desiredAgentId) {
				matchedIndex = i;
				break;
			}
			conflictingAgentId = currentAgentId;
		}
		if (matchedIndex >= 0) {
			const matched = existingRoutes[matchedIndex];
			if (matched) {
				removeIndexes.add(matchedIndex);
				removed.push(matched);
			}
			continue;
		}
		if (conflictingAgentId) {
			conflicts.push({
				binding,
				existingAgentId: conflictingAgentId
			});
			continue;
		}
		missing.push(binding);
	}
	if (removeIndexes.size === 0) return {
		config: cfg,
		removed,
		missing,
		conflicts
	};
	const nextBindings = [...existingRoutes.filter((_, index) => !removeIndexes.has(index)), ...nonRouteBindings];
	return {
		config: {
			...cfg,
			bindings: nextBindings.length > 0 ? nextBindings : void 0
		},
		removed,
		missing,
		conflicts
	};
}
function resolveDefaultAccountId$1(cfg, provider) {
	const plugin = getChannelPlugin(provider);
	if (!plugin) return DEFAULT_ACCOUNT_ID;
	return resolveChannelDefaultAccountId({
		plugin,
		cfg
	});
}
function resolveBindingAccountId(params) {
	const explicitAccountId = params.explicitAccountId?.trim();
	if (explicitAccountId) return explicitAccountId;
	const plugin = getChannelPlugin(params.channel);
	const pluginAccountId = plugin?.setup?.resolveBindingAccountId?.({
		cfg: params.config,
		agentId: params.agentId
	});
	if (pluginAccountId?.trim()) return pluginAccountId.trim();
	if (plugin?.meta.forceAccountBinding) return resolveDefaultAccountId$1(params.config, params.channel);
}
function buildChannelBindings(params) {
	const bindings = [];
	const agentId = normalizeAgentId(params.agentId);
	for (const channel of params.selection) {
		const match = { channel };
		const accountId = resolveBindingAccountId({
			channel,
			config: params.config,
			agentId,
			explicitAccountId: params.accountIds?.[channel]
		});
		if (accountId) match.accountId = accountId;
		bindings.push({
			type: "route",
			agentId,
			match
		});
	}
	return bindings;
}
function parseBindingSpecs(params) {
	const bindings = [];
	const errors = [];
	const specs = params.specs ?? [];
	const agentId = normalizeAgentId(params.agentId);
	for (const raw of specs) {
		const trimmed = raw?.trim();
		if (!trimmed) continue;
		const [channelRaw, accountRaw] = trimmed.split(":", 2);
		const channel = normalizeChannelId(channelRaw);
		if (!channel) {
			errors.push(`Unknown channel "${channelRaw}".`);
			continue;
		}
		let accountId = accountRaw?.trim();
		if (accountRaw !== void 0 && !accountId) {
			errors.push(`Invalid binding "${trimmed}" (empty account id).`);
			continue;
		}
		accountId = resolveBindingAccountId({
			channel,
			config: params.config,
			agentId,
			explicitAccountId: accountId
		});
		const match = { channel };
		if (accountId) match.accountId = accountId;
		bindings.push({
			type: "route",
			agentId,
			match
		});
	}
	return {
		bindings,
		errors
	};
}
//#endregion
//#region src/commands/agents.command-shared.ts
function createQuietRuntime(runtime) {
	return {
		...runtime,
		log: () => {}
	};
}
async function requireValidConfig(runtime) {
	return await requireValidConfigSnapshot(runtime);
}
//#endregion
//#region src/commands/agents.commands.bind.ts
function resolveAgentId(cfg, agentInput, params) {
	if (!cfg) return null;
	if (agentInput?.trim()) return normalizeAgentId(agentInput);
	if (params?.fallbackToDefault) return resolveDefaultAgentId(cfg);
	return null;
}
function hasAgent(cfg, agentId) {
	if (!cfg) return false;
	return buildAgentSummaries(cfg).some((summary) => summary.id === agentId);
}
function formatBindingOwnerLine(binding) {
	return `${normalizeAgentId(binding.agentId)} <- ${describeBinding(binding)}`;
}
function resolveTargetAgentIdOrExit(params) {
	const agentId = resolveAgentId(params.cfg, params.agentInput?.trim(), { fallbackToDefault: true });
	if (!agentId) {
		params.runtime.error("Unable to resolve agent id.");
		params.runtime.exit(1);
		return null;
	}
	if (!hasAgent(params.cfg, agentId)) {
		params.runtime.error(`Agent "${agentId}" not found.`);
		params.runtime.exit(1);
		return null;
	}
	return agentId;
}
function formatBindingConflicts(conflicts) {
	return conflicts.map((conflict) => `${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`);
}
function resolveParsedBindingsOrExit(params) {
	const specs = (params.bindValues ?? []).map((value) => value.trim()).filter(Boolean);
	if (specs.length === 0) {
		params.runtime.error(params.emptyMessage);
		params.runtime.exit(1);
		return null;
	}
	const parsed = parseBindingSpecs({
		agentId: params.agentId,
		specs,
		config: params.cfg
	});
	if (parsed.errors.length > 0) {
		params.runtime.error(parsed.errors.join("\n"));
		params.runtime.exit(1);
		return null;
	}
	return parsed;
}
function emitJsonPayload(params) {
	if (!params.json) return false;
	params.runtime.log(JSON.stringify(params.payload, null, 2));
	if ((params.conflictCount ?? 0) > 0) params.runtime.exit(1);
	return true;
}
async function resolveConfigAndTargetAgentIdOrExit(params) {
	const cfg = await requireValidConfig(params.runtime);
	if (!cfg) return null;
	const agentId = resolveTargetAgentIdOrExit({
		cfg,
		runtime: params.runtime,
		agentInput: params.agentInput
	});
	if (!agentId) return null;
	return {
		cfg,
		agentId
	};
}
async function agentsBindingsCommand(opts, runtime = defaultRuntime) {
	const cfg = await requireValidConfig(runtime);
	if (!cfg) return;
	const filterAgentId = resolveAgentId(cfg, opts.agent?.trim());
	if (opts.agent && !filterAgentId) {
		runtime.error("Agent id is required.");
		runtime.exit(1);
		return;
	}
	if (filterAgentId && !hasAgent(cfg, filterAgentId)) {
		runtime.error(`Agent "${filterAgentId}" not found.`);
		runtime.exit(1);
		return;
	}
	const filtered = listRouteBindings(cfg).filter((binding) => !filterAgentId || normalizeAgentId(binding.agentId) === filterAgentId);
	if (opts.json) {
		runtime.log(JSON.stringify(filtered.map((binding) => ({
			agentId: normalizeAgentId(binding.agentId),
			match: binding.match,
			description: describeBinding(binding)
		})), null, 2));
		return;
	}
	if (filtered.length === 0) {
		runtime.log(filterAgentId ? `No routing bindings for agent "${filterAgentId}".` : "No routing bindings.");
		return;
	}
	runtime.log(["Routing bindings:", ...filtered.map((binding) => `- ${formatBindingOwnerLine(binding)}`)].join("\n"));
}
async function agentsBindCommand(opts, runtime = defaultRuntime) {
	const resolved = await resolveConfigAndTargetAgentIdOrExit({
		runtime,
		agentInput: opts.agent
	});
	if (!resolved) return;
	const { cfg, agentId } = resolved;
	const parsed = resolveParsedBindingsOrExit({
		runtime,
		cfg,
		agentId,
		bindValues: opts.bind,
		emptyMessage: "Provide at least one --bind <channel[:accountId]>."
	});
	if (!parsed) return;
	const result = applyAgentBindings(cfg, parsed.bindings);
	if (result.added.length > 0 || result.updated.length > 0) {
		await writeConfigFile(result.config);
		if (!opts.json) logConfigUpdated(runtime);
	}
	const payload = {
		agentId,
		added: result.added.map(describeBinding),
		updated: result.updated.map(describeBinding),
		skipped: result.skipped.map(describeBinding),
		conflicts: formatBindingConflicts(result.conflicts)
	};
	if (emitJsonPayload({
		runtime,
		json: opts.json,
		payload,
		conflictCount: result.conflicts.length
	})) return;
	if (result.added.length > 0) {
		runtime.log("Added bindings:");
		for (const binding of result.added) runtime.log(`- ${describeBinding(binding)}`);
	} else if (result.updated.length === 0) runtime.log("No new bindings added.");
	if (result.updated.length > 0) {
		runtime.log("Updated bindings:");
		for (const binding of result.updated) runtime.log(`- ${describeBinding(binding)}`);
	}
	if (result.skipped.length > 0) {
		runtime.log("Already present:");
		for (const binding of result.skipped) runtime.log(`- ${describeBinding(binding)}`);
	}
	if (result.conflicts.length > 0) {
		runtime.error("Skipped bindings already claimed by another agent:");
		for (const conflict of result.conflicts) runtime.error(`- ${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`);
		runtime.exit(1);
	}
}
async function agentsUnbindCommand(opts, runtime = defaultRuntime) {
	const resolved = await resolveConfigAndTargetAgentIdOrExit({
		runtime,
		agentInput: opts.agent
	});
	if (!resolved) return;
	const { cfg, agentId } = resolved;
	if (opts.all && (opts.bind?.length ?? 0) > 0) {
		runtime.error("Use either --all or --bind, not both.");
		runtime.exit(1);
		return;
	}
	if (opts.all) {
		const existing = listRouteBindings(cfg);
		const removed = existing.filter((binding) => normalizeAgentId(binding.agentId) === agentId);
		const keptRoutes = existing.filter((binding) => normalizeAgentId(binding.agentId) !== agentId);
		const nonRoutes = (cfg.bindings ?? []).filter((binding) => !isRouteBinding(binding));
		if (removed.length === 0) {
			runtime.log(`No bindings to remove for agent "${agentId}".`);
			return;
		}
		await writeConfigFile({
			...cfg,
			bindings: [...keptRoutes, ...nonRoutes].length > 0 ? [...keptRoutes, ...nonRoutes] : void 0
		});
		if (!opts.json) logConfigUpdated(runtime);
		const payload = {
			agentId,
			removed: removed.map(describeBinding),
			missing: [],
			conflicts: []
		};
		if (emitJsonPayload({
			runtime,
			json: opts.json,
			payload
		})) return;
		runtime.log(`Removed ${removed.length} binding(s) for "${agentId}".`);
		return;
	}
	const parsed = resolveParsedBindingsOrExit({
		runtime,
		cfg,
		agentId,
		bindValues: opts.bind,
		emptyMessage: "Provide at least one --bind <channel[:accountId]> or use --all."
	});
	if (!parsed) return;
	const result = removeAgentBindings(cfg, parsed.bindings);
	if (result.removed.length > 0) {
		await writeConfigFile(result.config);
		if (!opts.json) logConfigUpdated(runtime);
	}
	const payload = {
		agentId,
		removed: result.removed.map(describeBinding),
		missing: result.missing.map(describeBinding),
		conflicts: formatBindingConflicts(result.conflicts)
	};
	if (emitJsonPayload({
		runtime,
		json: opts.json,
		payload,
		conflictCount: result.conflicts.length
	})) return;
	if (result.removed.length > 0) {
		runtime.log("Removed bindings:");
		for (const binding of result.removed) runtime.log(`- ${describeBinding(binding)}`);
	} else runtime.log("No bindings removed.");
	if (result.missing.length > 0) {
		runtime.log("Not found:");
		for (const binding of result.missing) runtime.log(`- ${describeBinding(binding)}`);
	}
	if (result.conflicts.length > 0) {
		runtime.error("Bindings are owned by another agent:");
		for (const conflict of result.conflicts) runtime.error(`- ${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`);
		runtime.exit(1);
	}
}
//#endregion
//#region src/commands/agents.commands.add.ts
async function fileExists(pathname) {
	try {
		await fs.stat(pathname);
		return true;
	} catch {
		return false;
	}
}
async function agentsAddCommand(opts, runtime = defaultRuntime, params) {
	const cfg = await requireValidConfig(runtime);
	if (!cfg) return;
	const workspaceFlag = opts.workspace?.trim();
	const nameInput = opts.name?.trim();
	const hasFlags = params?.hasFlags === true;
	const nonInteractive = Boolean(opts.nonInteractive || hasFlags);
	if (nonInteractive && !workspaceFlag) {
		runtime.error("Non-interactive mode requires --workspace. Re-run without flags to use the wizard.");
		runtime.exit(1);
		return;
	}
	if (nonInteractive) {
		if (!nameInput) {
			runtime.error("Agent name is required in non-interactive mode.");
			runtime.exit(1);
			return;
		}
		if (!workspaceFlag) {
			runtime.error("Non-interactive mode requires --workspace. Re-run without flags to use the wizard.");
			runtime.exit(1);
			return;
		}
		const agentId = normalizeAgentId(nameInput);
		if (agentId === "main") {
			runtime.error(`"${DEFAULT_AGENT_ID}" is reserved. Choose another name.`);
			runtime.exit(1);
			return;
		}
		if (agentId !== nameInput) runtime.log(`Normalized agent id to "${agentId}".`);
		if (findAgentEntryIndex(listAgentEntries(cfg), agentId) >= 0) {
			runtime.error(`Agent "${agentId}" already exists.`);
			runtime.exit(1);
			return;
		}
		const workspaceDir = resolveUserPath(workspaceFlag);
		const agentDir = opts.agentDir?.trim() ? resolveUserPath(opts.agentDir.trim()) : resolveAgentDir(cfg, agentId);
		const model = opts.model?.trim();
		const nextConfig = applyAgentConfig(cfg, {
			agentId,
			name: nameInput,
			workspace: workspaceDir,
			agentDir,
			...model ? { model } : {}
		});
		const bindingParse = parseBindingSpecs({
			agentId,
			specs: opts.bind,
			config: nextConfig
		});
		if (bindingParse.errors.length > 0) {
			runtime.error(bindingParse.errors.join("\n"));
			runtime.exit(1);
			return;
		}
		const bindingResult = bindingParse.bindings.length > 0 ? applyAgentBindings(nextConfig, bindingParse.bindings) : {
			config: nextConfig,
			added: [],
			updated: [],
			skipped: [],
			conflicts: []
		};
		await writeConfigFile(bindingResult.config);
		if (!opts.json) logConfigUpdated(runtime);
		await ensureWorkspaceAndSessions(workspaceDir, opts.json ? createQuietRuntime(runtime) : runtime, {
			skipBootstrap: Boolean(bindingResult.config.agents?.defaults?.skipBootstrap),
			agentId
		});
		const payload = {
			agentId,
			name: nameInput,
			workspace: workspaceDir,
			agentDir,
			model,
			bindings: {
				added: bindingResult.added.map(describeBinding),
				updated: bindingResult.updated.map(describeBinding),
				skipped: bindingResult.skipped.map(describeBinding),
				conflicts: bindingResult.conflicts.map((conflict) => `${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`)
			}
		};
		if (opts.json) runtime.log(JSON.stringify(payload, null, 2));
		else {
			runtime.log(`Agent: ${agentId}`);
			runtime.log(`Workspace: ${shortenHomePath(workspaceDir)}`);
			runtime.log(`Agent dir: ${shortenHomePath(agentDir)}`);
			if (model) runtime.log(`Model: ${model}`);
			if (bindingResult.conflicts.length > 0) runtime.error(["Skipped bindings already claimed by another agent:", ...bindingResult.conflicts.map((conflict) => `- ${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`)].join("\n"));
		}
		return;
	}
	const prompter = createClackPrompter();
	try {
		await prompter.intro("Add OpenClaw agent");
		const name = nameInput ?? await prompter.text({
			message: "Agent name",
			validate: (value) => {
				if (!value?.trim()) return "Required";
				if (normalizeAgentId(value) === "main") return `"main" is reserved. Choose another name.`;
			}
		});
		const agentName = String(name ?? "").trim();
		const agentId = normalizeAgentId(agentName);
		if (agentName !== agentId) await prompter.note(`Normalized id to "${agentId}".`, "Agent id");
		if (listAgentEntries(cfg).find((agent) => normalizeAgentId(agent.id) === agentId)) {
			if (!await prompter.confirm({
				message: `Agent "${agentId}" already exists. Update it?`,
				initialValue: false
			})) {
				await prompter.outro("No changes made.");
				return;
			}
		}
		const workspaceDefault = resolveAgentWorkspaceDir(cfg, agentId);
		const workspaceInput = await prompter.text({
			message: "Workspace directory",
			initialValue: workspaceDefault,
			validate: (value) => value?.trim() ? void 0 : "Required"
		});
		const workspaceDir = resolveUserPath(String(workspaceInput ?? "").trim() || workspaceDefault);
		const agentDir = resolveAgentDir(cfg, agentId);
		let nextConfig = applyAgentConfig(cfg, {
			agentId,
			name: agentName,
			workspace: workspaceDir,
			agentDir
		});
		const defaultAgentId = resolveDefaultAgentId(cfg);
		if (defaultAgentId !== agentId) {
			const sourceAuthPath = resolveAuthStorePath(resolveAgentDir(cfg, defaultAgentId));
			const destAuthPath = resolveAuthStorePath(agentDir);
			if (!(path.resolve(sourceAuthPath).toLowerCase() === path.resolve(destAuthPath).toLowerCase()) && await fileExists(sourceAuthPath) && !await fileExists(destAuthPath)) {
				if (await prompter.confirm({
					message: `Copy auth profiles from "${defaultAgentId}"?`,
					initialValue: false
				})) {
					await fs.mkdir(path.dirname(destAuthPath), { recursive: true });
					await fs.copyFile(sourceAuthPath, destAuthPath);
					await prompter.note(`Copied auth profiles from "${defaultAgentId}".`, "Auth profiles");
				}
			}
		}
		if (await prompter.confirm({
			message: "Configure model/auth for this agent now?",
			initialValue: false
		})) {
			const authResult = await applyAuthChoice({
				authChoice: await promptAuthChoiceGrouped({
					prompter,
					store: ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false }),
					includeSkip: true,
					config: nextConfig
				}),
				config: nextConfig,
				prompter,
				runtime,
				agentDir,
				setDefaultModel: false,
				agentId
			});
			nextConfig = authResult.config;
			if (authResult.agentModelOverride) nextConfig = applyAgentConfig(nextConfig, {
				agentId,
				model: authResult.agentModelOverride
			});
		}
		await warnIfModelConfigLooksOff(nextConfig, prompter, {
			agentId,
			agentDir
		});
		let selection = [];
		const channelAccountIds = {};
		nextConfig = await setupChannels(nextConfig, runtime, prompter, {
			allowSignalInstall: true,
			onSelection: (value) => {
				selection = value;
			},
			promptAccountIds: true,
			onAccountId: (channel, accountId) => {
				channelAccountIds[channel] = accountId;
			}
		});
		if (selection.length > 0) if (await prompter.confirm({
			message: "Route selected channels to this agent now? (bindings)",
			initialValue: false
		})) {
			const desiredBindings = buildChannelBindings({
				agentId,
				selection,
				config: nextConfig,
				accountIds: channelAccountIds
			});
			const result = applyAgentBindings(nextConfig, desiredBindings);
			nextConfig = result.config;
			if (result.conflicts.length > 0) await prompter.note(["Skipped bindings already claimed by another agent:", ...result.conflicts.map((conflict) => `- ${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`)].join("\n"), "Routing bindings");
		} else await prompter.note(["Routing unchanged. Add bindings when you're ready.", "Docs: https://docs.openclaw.ai/concepts/multi-agent"].join("\n"), "Routing");
		await writeConfigFile(nextConfig);
		logConfigUpdated(runtime);
		await ensureWorkspaceAndSessions(workspaceDir, runtime, {
			skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
			agentId
		});
		const payload = {
			agentId,
			name: agentName,
			workspace: workspaceDir,
			agentDir
		};
		if (opts.json) runtime.log(JSON.stringify(payload, null, 2));
		await prompter.outro(`Agent "${agentId}" ready.`);
	} catch (err) {
		if (err instanceof WizardCancelledError) {
			runtime.exit(1);
			return;
		}
		throw err;
	}
}
//#endregion
//#region src/commands/agents.commands.delete.ts
async function agentsDeleteCommand(opts, runtime = defaultRuntime) {
	const cfg = await requireValidConfig(runtime);
	if (!cfg) return;
	const input = opts.id?.trim();
	if (!input) {
		runtime.error("Agent id is required.");
		runtime.exit(1);
		return;
	}
	const agentId = normalizeAgentId(input);
	if (agentId !== input) runtime.log(`Normalized agent id to "${agentId}".`);
	if (agentId === "main") {
		runtime.error(`"${DEFAULT_AGENT_ID}" cannot be deleted.`);
		runtime.exit(1);
		return;
	}
	if (findAgentEntryIndex(listAgentEntries(cfg), agentId) < 0) {
		runtime.error(`Agent "${agentId}" not found.`);
		runtime.exit(1);
		return;
	}
	if (!opts.force) {
		if (!process.stdin.isTTY) {
			runtime.error("Non-interactive session. Re-run with --force.");
			runtime.exit(1);
			return;
		}
		if (!await createClackPrompter().confirm({
			message: `Delete agent "${agentId}" and prune workspace/state?`,
			initialValue: false
		})) {
			runtime.log("Cancelled.");
			return;
		}
	}
	const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
	const agentDir = resolveAgentDir(cfg, agentId);
	const sessionsDir = resolveSessionTranscriptsDirForAgent(agentId);
	const result = pruneAgentConfig(cfg, agentId);
	await writeConfigFile(result.config);
	if (!opts.json) logConfigUpdated(runtime);
	const quietRuntime = opts.json ? createQuietRuntime(runtime) : runtime;
	await moveToTrash(workspaceDir, quietRuntime);
	await moveToTrash(agentDir, quietRuntime);
	await moveToTrash(sessionsDir, quietRuntime);
	if (opts.json) runtime.log(JSON.stringify({
		agentId,
		workspace: workspaceDir,
		agentDir,
		sessionsDir,
		removedBindings: result.removedBindings,
		removedAllow: result.removedAllow
	}, null, 2));
	else runtime.log(`Deleted agent: ${agentId}`);
}
//#endregion
//#region src/commands/agents.commands.identity.ts
const normalizeWorkspacePath = (input) => path.resolve(resolveUserPath(input));
const coerceTrimmed = (value) => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : void 0;
};
async function loadIdentityFromFile(filePath) {
	try {
		const parsed = parseIdentityMarkdown(await fs.readFile(filePath, "utf-8"));
		if (!identityHasValues(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
function resolveAgentIdByWorkspace(cfg, workspaceDir) {
	const list = listAgentEntries(cfg);
	const ids = list.length > 0 ? list.map((entry) => normalizeAgentId(entry.id)) : [resolveDefaultAgentId(cfg)];
	const normalizedTarget = normalizeWorkspacePath(workspaceDir);
	return ids.filter((id) => normalizeWorkspacePath(resolveAgentWorkspaceDir(cfg, id)) === normalizedTarget);
}
async function agentsSetIdentityCommand(opts, runtime = defaultRuntime) {
	const cfg = await requireValidConfig(runtime);
	if (!cfg) return;
	const agentRaw = coerceTrimmed(opts.agent);
	const nameRaw = coerceTrimmed(opts.name);
	const emojiRaw = coerceTrimmed(opts.emoji);
	const themeRaw = coerceTrimmed(opts.theme);
	const avatarRaw = coerceTrimmed(opts.avatar);
	const hasExplicitIdentity = Boolean(nameRaw || emojiRaw || themeRaw || avatarRaw);
	const identityFileRaw = coerceTrimmed(opts.identityFile);
	const workspaceRaw = coerceTrimmed(opts.workspace);
	const wantsIdentityFile = Boolean(opts.fromIdentity || identityFileRaw || !hasExplicitIdentity);
	let identityFilePath;
	let workspaceDir;
	if (identityFileRaw) {
		identityFilePath = normalizeWorkspacePath(identityFileRaw);
		workspaceDir = path.dirname(identityFilePath);
	} else if (workspaceRaw) workspaceDir = normalizeWorkspacePath(workspaceRaw);
	else if (wantsIdentityFile || !agentRaw) workspaceDir = path.resolve(process.cwd());
	let agentId = agentRaw ? normalizeAgentId(agentRaw) : void 0;
	if (!agentId) {
		if (!workspaceDir) {
			runtime.error("Select an agent with --agent or provide a workspace via --workspace.");
			runtime.exit(1);
			return;
		}
		const matches = resolveAgentIdByWorkspace(cfg, workspaceDir);
		if (matches.length === 0) {
			runtime.error(`No agent workspace matches ${shortenHomePath(workspaceDir)}. Pass --agent to target a specific agent.`);
			runtime.exit(1);
			return;
		}
		if (matches.length > 1) {
			runtime.error(`Multiple agents match ${shortenHomePath(workspaceDir)}: ${matches.join(", ")}. Pass --agent to choose one.`);
			runtime.exit(1);
			return;
		}
		agentId = matches[0];
	}
	let identityFromFile = null;
	if (wantsIdentityFile) {
		if (identityFilePath) identityFromFile = await loadIdentityFromFile(identityFilePath);
		else if (workspaceDir) identityFromFile = loadAgentIdentity(workspaceDir);
		if (!identityFromFile) {
			const targetPath = identityFilePath ?? (workspaceDir ? path.join(workspaceDir, "IDENTITY.md") : "IDENTITY.md");
			runtime.error(`No identity data found in ${shortenHomePath(targetPath)}.`);
			runtime.exit(1);
			return;
		}
	}
	const fileTheme = identityFromFile?.theme ?? identityFromFile?.creature ?? identityFromFile?.vibe ?? void 0;
	const incomingIdentity = {
		...nameRaw || identityFromFile?.name ? { name: nameRaw ?? identityFromFile?.name } : {},
		...emojiRaw || identityFromFile?.emoji ? { emoji: emojiRaw ?? identityFromFile?.emoji } : {},
		...themeRaw || fileTheme ? { theme: themeRaw ?? fileTheme } : {},
		...avatarRaw || identityFromFile?.avatar ? { avatar: avatarRaw ?? identityFromFile?.avatar } : {}
	};
	if (!incomingIdentity.name && !incomingIdentity.emoji && !incomingIdentity.theme && !incomingIdentity.avatar) {
		runtime.error("No identity fields provided. Use --name/--emoji/--theme/--avatar or --from-identity.");
		runtime.exit(1);
		return;
	}
	const list = listAgentEntries(cfg);
	const index = findAgentEntryIndex(list, agentId);
	const base = index >= 0 ? list[index] : { id: agentId };
	const nextIdentity = {
		...base.identity,
		...incomingIdentity
	};
	const nextEntry = {
		...base,
		identity: nextIdentity
	};
	const nextList = [...list];
	if (index >= 0) nextList[index] = nextEntry;
	else {
		const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
		if (nextList.length === 0 && agentId !== defaultId) nextList.push({ id: defaultId });
		nextList.push(nextEntry);
	}
	await writeConfigFile({
		...cfg,
		agents: {
			...cfg.agents,
			list: nextList
		}
	});
	if (opts.json) {
		runtime.log(JSON.stringify({
			agentId,
			identity: nextIdentity,
			workspace: workspaceDir ?? null,
			identityFile: identityFilePath ?? null
		}, null, 2));
		return;
	}
	logConfigUpdated(runtime);
	runtime.log(`Agent: ${agentId}`);
	if (nextIdentity.name) runtime.log(`Name: ${nextIdentity.name}`);
	if (nextIdentity.theme) runtime.log(`Theme: ${nextIdentity.theme}`);
	if (nextIdentity.emoji) runtime.log(`Emoji: ${nextIdentity.emoji}`);
	if (nextIdentity.avatar) runtime.log(`Avatar: ${nextIdentity.avatar}`);
	if (workspaceDir) runtime.log(`Workspace: ${shortenHomePath(workspaceDir)}`);
}
//#endregion
//#region src/commands/agents.providers.ts
function providerAccountKey(provider, accountId) {
	return `${provider}:${accountId ?? "default"}`;
}
function formatChannelAccountLabel(params) {
	return `${getChannelPlugin(params.provider)?.meta.label ?? params.provider} ${params.name?.trim() ? `${params.accountId} (${params.name.trim()})` : params.accountId}`;
}
function formatProviderState(entry) {
	const parts = [entry.state];
	if (entry.enabled === false && entry.state !== "disabled") parts.push("disabled");
	return parts.join(", ");
}
async function buildProviderStatusIndex(cfg) {
	const map = /* @__PURE__ */ new Map();
	for (const plugin of listChannelPlugins()) {
		const accountIds = plugin.config.listAccountIds(cfg);
		for (const accountId of accountIds) {
			const account = plugin.config.resolveAccount(cfg, accountId);
			const snapshot = plugin.config.describeAccount?.(account, cfg);
			const enabled = plugin.config.isEnabled ? plugin.config.isEnabled(account, cfg) : typeof snapshot?.enabled === "boolean" ? snapshot.enabled : account.enabled;
			const configured = plugin.config.isConfigured ? await plugin.config.isConfigured(account, cfg) : snapshot?.configured;
			const resolvedEnabled = typeof enabled === "boolean" ? enabled : true;
			const resolvedConfigured = typeof configured === "boolean" ? configured : true;
			const state = plugin.status?.resolveAccountState?.({
				account,
				cfg,
				configured: resolvedConfigured,
				enabled: resolvedEnabled
			}) ?? (typeof snapshot?.linked === "boolean" ? snapshot.linked ? "linked" : "not linked" : resolvedConfigured ? "configured" : "not configured");
			const name = snapshot?.name ?? account.name;
			map.set(providerAccountKey(plugin.id, accountId), {
				provider: plugin.id,
				accountId,
				name,
				state,
				enabled,
				configured
			});
		}
	}
	return map;
}
function resolveDefaultAccountId(cfg, provider) {
	const plugin = getChannelPlugin(provider);
	if (!plugin) return DEFAULT_ACCOUNT_ID;
	return resolveChannelDefaultAccountId({
		plugin,
		cfg
	});
}
function shouldShowProviderEntry(entry, cfg) {
	const plugin = getChannelPlugin(entry.provider);
	if (!plugin) return Boolean(entry.configured);
	if (plugin.meta.showConfigured === false) {
		const providerConfig = cfg[plugin.id];
		return Boolean(entry.configured) || Boolean(providerConfig);
	}
	return Boolean(entry.configured);
}
function formatProviderEntry(entry) {
	return `${formatChannelAccountLabel({
		provider: entry.provider,
		accountId: entry.accountId,
		name: entry.name
	})}: ${formatProviderState(entry)}`;
}
function summarizeBindings(cfg, bindings) {
	if (bindings.length === 0) return [];
	const seen = /* @__PURE__ */ new Map();
	for (const binding of bindings) {
		const channel = normalizeChannelId(binding.match.channel);
		if (!channel) continue;
		const accountId = binding.match.accountId ?? resolveDefaultAccountId(cfg, channel);
		const key = providerAccountKey(channel, accountId);
		if (!seen.has(key)) {
			const label = formatChannelAccountLabel({
				provider: channel,
				accountId
			});
			seen.set(key, label);
		}
	}
	return [...seen.values()];
}
function listProvidersForAgent(params) {
	const allProviderEntries = [...params.providerStatus.values()];
	const providerLines = [];
	if (params.bindings.length > 0) {
		const seen = /* @__PURE__ */ new Set();
		for (const binding of params.bindings) {
			const channel = normalizeChannelId(binding.match.channel);
			if (!channel) continue;
			const accountId = binding.match.accountId ?? resolveDefaultAccountId(params.cfg, channel);
			const key = providerAccountKey(channel, accountId);
			if (seen.has(key)) continue;
			seen.add(key);
			const status = params.providerStatus.get(key);
			if (status) providerLines.push(formatProviderEntry(status));
			else providerLines.push(`${formatChannelAccountLabel({
				provider: channel,
				accountId
			})}: unknown`);
		}
		return providerLines;
	}
	if (params.summaryIsDefault) {
		for (const entry of allProviderEntries) if (shouldShowProviderEntry(entry, params.cfg)) providerLines.push(formatProviderEntry(entry));
	}
	return providerLines;
}
//#endregion
//#region src/commands/agents.commands.list.ts
function formatSummary(summary) {
	const defaultTag = summary.isDefault ? " (default)" : "";
	const header = summary.name && summary.name !== summary.id ? `${summary.id}${defaultTag} (${summary.name})` : `${summary.id}${defaultTag}`;
	const identityParts = [];
	if (summary.identityEmoji) identityParts.push(summary.identityEmoji);
	if (summary.identityName) identityParts.push(summary.identityName);
	const identityLine = identityParts.length > 0 ? identityParts.join(" ") : null;
	const identitySource = summary.identitySource === "identity" ? "IDENTITY.md" : summary.identitySource === "config" ? "config" : null;
	const lines = [`- ${header}`];
	if (identityLine) lines.push(`  Identity: ${identityLine}${identitySource ? ` (${identitySource})` : ""}`);
	lines.push(`  Workspace: ${shortenHomePath(summary.workspace)}`);
	lines.push(`  Agent dir: ${shortenHomePath(summary.agentDir)}`);
	if (summary.model) lines.push(`  Model: ${summary.model}`);
	lines.push(`  Routing rules: ${summary.bindings}`);
	if (summary.routes?.length) lines.push(`  Routing: ${summary.routes.join(", ")}`);
	if (summary.providers?.length) {
		lines.push("  Providers:");
		for (const provider of summary.providers) lines.push(`    - ${provider}`);
	}
	if (summary.bindingDetails?.length) {
		lines.push("  Routing rules:");
		for (const binding of summary.bindingDetails) lines.push(`    - ${binding}`);
	}
	return lines.join("\n");
}
async function agentsListCommand(opts, runtime = defaultRuntime) {
	const cfg = await requireValidConfig(runtime);
	if (!cfg) return;
	const summaries = buildAgentSummaries(cfg);
	const bindingMap = /* @__PURE__ */ new Map();
	for (const binding of listRouteBindings(cfg)) {
		const agentId = normalizeAgentId(binding.agentId);
		const list = bindingMap.get(agentId) ?? [];
		list.push(binding);
		bindingMap.set(agentId, list);
	}
	if (opts.bindings) for (const summary of summaries) {
		const bindings = bindingMap.get(summary.id) ?? [];
		if (bindings.length > 0) summary.bindingDetails = bindings.map((binding) => describeBinding(binding));
	}
	const providerStatus = await buildProviderStatusIndex(cfg);
	for (const summary of summaries) {
		const bindings = bindingMap.get(summary.id) ?? [];
		const routes = summarizeBindings(cfg, bindings);
		if (routes.length > 0) summary.routes = routes;
		else if (summary.isDefault) summary.routes = ["default (no explicit rules)"];
		const providerLines = listProvidersForAgent({
			summaryIsDefault: summary.isDefault,
			cfg,
			bindings,
			providerStatus
		});
		if (providerLines.length > 0) summary.providers = providerLines;
	}
	if (opts.json) {
		runtime.log(JSON.stringify(summaries, null, 2));
		return;
	}
	const lines = ["Agents:", ...summaries.map(formatSummary)];
	lines.push("Routing rules map channel/account/peer to an agent. Use --bindings for full rules.");
	lines.push(`Channel status reflects local config/creds. For live health: ${formatCliCommand("openclaw channels status --probe")}.`);
	runtime.log(lines.join("\n"));
}
//#endregion
export { agentsAddCommand, agentsBindCommand, agentsBindingsCommand, agentsDeleteCommand, agentsListCommand, agentsSetIdentityCommand, agentsUnbindCommand };
