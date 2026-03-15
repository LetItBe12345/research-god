import { f as defaultRuntime, k as theme } from "./subsystem-C1ZwgyXv.js";
import "./paths-dQ_clcF4.js";
import "./boolean-BHdNsbzF.js";
import { Cp as createConfigIO, jp as writeConfigFile } from "./auth-profiles-DZ4zIQH4.js";
import { D as ensureAgentWorkspace, v as DEFAULT_AGENT_WORKSPACE_DIR } from "./agent-scope-lHks6gb9.js";
import { _ as shortenHomePath } from "./utils-D0Yqqtk-.js";
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
import { s as resolveSessionTranscriptsDir } from "./paths-CmL1n6G7.js";
import "./session-cost-usage-Zj7Y3VA9.js";
import { t as formatDocsLink } from "./links-BmJbo-zG.js";
import { n as runCommandWithRuntime } from "./cli-utils-Cc7goTOv.js";
import { t as hasExplicitOptions } from "./command-options-LK1l2nka.js";
import "./runtime-guard-J6FFyZo2.js";
import "./onboard-helpers-4CUqO3j0.js";
import "./prompt-style-B3R7Bffy.js";
import "./onboarding-pmml8EW1.js";
import { n as logConfigUpdated, t as formatConfigPath } from "./logging-D3TCKWkc.js";
import "./note-QL6AfaP7.js";
import "./clack-prompter-BsorKzB7.js";
import { t as onboardCommand } from "./onboard-BPg3lS7u.js";
import JSON5 from "json5";
import fs from "node:fs/promises";
//#region src/commands/setup.ts
async function readConfigFileRaw(configPath) {
	try {
		const raw = await fs.readFile(configPath, "utf-8");
		const parsed = JSON5.parse(raw);
		if (parsed && typeof parsed === "object") return {
			exists: true,
			parsed
		};
		return {
			exists: true,
			parsed: {}
		};
	} catch {
		return {
			exists: false,
			parsed: {}
		};
	}
}
async function setupCommand(opts, runtime = defaultRuntime) {
	const desiredWorkspace = typeof opts?.workspace === "string" && opts.workspace.trim() ? opts.workspace.trim() : void 0;
	const configPath = createConfigIO().configPath;
	const existingRaw = await readConfigFileRaw(configPath);
	const cfg = existingRaw.parsed;
	const defaults = cfg.agents?.defaults ?? {};
	const workspace = desiredWorkspace ?? defaults.workspace ?? DEFAULT_AGENT_WORKSPACE_DIR;
	const next = {
		...cfg,
		agents: {
			...cfg.agents,
			defaults: {
				...defaults,
				workspace
			}
		},
		gateway: {
			...cfg.gateway,
			mode: cfg.gateway?.mode ?? "local"
		}
	};
	if (!existingRaw.exists || defaults.workspace !== workspace || cfg.gateway?.mode !== next.gateway?.mode) {
		await writeConfigFile(next);
		if (!existingRaw.exists) runtime.log(`Wrote ${formatConfigPath(configPath)}`);
		else {
			const updates = [];
			if (defaults.workspace !== workspace) updates.push("set agents.defaults.workspace");
			if (cfg.gateway?.mode !== next.gateway?.mode) updates.push("set gateway.mode");
			logConfigUpdated(runtime, {
				path: configPath,
				suffix: updates.length > 0 ? `(${updates.join(", ")})` : void 0
			});
		}
	} else runtime.log(`Config OK: ${formatConfigPath(configPath)}`);
	const ws = await ensureAgentWorkspace({
		dir: workspace,
		ensureBootstrapFiles: !next.agents?.defaults?.skipBootstrap
	});
	runtime.log(`Workspace OK: ${shortenHomePath(ws.dir)}`);
	const sessionsDir = resolveSessionTranscriptsDir();
	await fs.mkdir(sessionsDir, { recursive: true });
	runtime.log(`Sessions OK: ${shortenHomePath(sessionsDir)}`);
}
//#endregion
//#region src/cli/program/register.setup.ts
function registerSetupCommand(program) {
	program.command("setup").description("Initialize ~/.openclaw/openclaw.json and the agent workspace").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/setup", "docs.openclaw.ai/cli/setup")}\n`).option("--workspace <dir>", "Agent workspace directory (default: ~/.openclaw/workspace; stored as agents.defaults.workspace)").option("--wizard", "Run the interactive onboarding wizard", false).option("--non-interactive", "Run the wizard without prompts", false).option("--mode <mode>", "Wizard mode: local|remote").option("--remote-url <url>", "Remote Gateway WebSocket URL").option("--remote-token <token>", "Remote Gateway token (optional)").action(async (opts, command) => {
		await runCommandWithRuntime(defaultRuntime, async () => {
			const hasWizardFlags = hasExplicitOptions(command, [
				"wizard",
				"nonInteractive",
				"mode",
				"remoteUrl",
				"remoteToken"
			]);
			if (opts.wizard || hasWizardFlags) {
				await onboardCommand({
					workspace: opts.workspace,
					nonInteractive: Boolean(opts.nonInteractive),
					mode: opts.mode,
					remoteUrl: opts.remoteUrl,
					remoteToken: opts.remoteToken
				}, defaultRuntime);
				return;
			}
			await setupCommand({ workspace: opts.workspace }, defaultRuntime);
		});
	});
}
//#endregion
export { registerSetupCommand };
