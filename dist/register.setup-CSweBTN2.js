import "./paths-tuenh9TL.js";
import { f as defaultRuntime, k as theme } from "./subsystem-C5Ov5Tl6.js";
import { v as shortenHomePath } from "./utils-J_jJJlhx.js";
import { lm as writeConfigFile, tm as createConfigIO } from "./reply-BJBzAldK.js";
import { D as ensureAgentWorkspace, v as DEFAULT_AGENT_WORKSPACE_DIR } from "./agent-scope-mSwAEzsR.js";
import "./openclaw-root-BWGgUZ_i.js";
import "./exec-DUrziqOt.js";
import "./github-copilot-token-BpS_ZjgB.js";
import "./boolean-BU9WMbx8.js";
import "./env-OR0Y-huw.js";
import "./env-overrides-37xHf7xH.js";
import "./skills-yYj6k7r6.js";
import "./frontmatter-SlsKMQGu.js";
import "./query-expansion-FbPYVnkg.js";
import "./redact-CAos4U4e.js";
import "./path-alias-guards-C8KQ9P9S.js";
import "./errors-DVPXQeA6.js";
import "./cmd-argv-C0hFDCCx.js";
import "./restart-stale-pids-BQ4ZYZtt.js";
import "./delivery-queue-D5j15BIP.js";
import { s as resolveSessionTranscriptsDir } from "./paths-CCtAY9XW.js";
import "./session-cost-usage-CPJEuaoV.js";
import { t as formatDocsLink } from "./links-CQdKVoyv.js";
import { n as runCommandWithRuntime } from "./cli-utils-DOT-XcGX.js";
import "./runtime-guard-o6VhvYRO.js";
import { t as hasExplicitOptions } from "./command-options-B4uWzLSX.js";
import "./onboard-helpers-BEzP-_2l.js";
import "./prompt-style-CuhBzfSK.js";
import "./onboarding-IDprkTPk.js";
import { n as logConfigUpdated, t as formatConfigPath } from "./logging-BbQr4Z2M.js";
import "./note-heSZB4P7.js";
import "./clack-prompter-DR0CSNKU.js";
import { t as onboardCommand } from "./onboard-CJBg4mlm.js";
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
