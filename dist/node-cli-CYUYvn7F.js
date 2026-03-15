import { D as colorize, f as defaultRuntime, k as theme } from "./subsystem-C1ZwgyXv.js";
import "./paths-dQ_clcF4.js";
import "./boolean-BHdNsbzF.js";
import { q as formatHelpExamples } from "./auth-profiles-DZ4zIQH4.js";
import { t as formatCliCommand } from "./command-format-CO3N-oGG.js";
import "./agent-scope-lHks6gb9.js";
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
import { _ as resolveNodeWindowsTaskName, c as formatNodeServiceDescription, g as resolveNodeSystemdServiceName, h as resolveNodeLaunchAgentLabel } from "./constants-CNBV5j35.js";
import { t as formatDocsLink } from "./links-BmJbo-zG.js";
import "./cli-utils-Cc7goTOv.js";
import "./issue-format-C8GXLHk1.js";
import { l as buildNodeServiceEnvironment, n as resolveDaemonInstallRuntimeInputs, p as resolveNodeProgramArguments, t as emitDaemonInstallRuntimeWarning } from "./daemon-install-plan.shared-Cp3Ohrwt.js";
import "./runtime-guard-J6FFyZo2.js";
import { r as isGatewayDaemonRuntime, t as DEFAULT_GATEWAY_DAEMON_RUNTIME } from "./daemon-runtime-DnPtziIn.js";
import "./runtime-parse-pVlvZ5Tt.js";
import "./launchd-BYHD2rMv.js";
import "./service-B9uQ0VXf.js";
import "./systemd-BJIjjTO2.js";
import { _ as installDaemonServiceAndEmit, a as createCliStatusTextStyles, g as buildDaemonServiceSnapshot, i as runServiceUninstall, m as resolveRuntimeStatusColor, o as createDaemonInstallActionContext, r as runServiceStop, s as failIfNixDaemonInstallMode, t as runServiceRestart } from "./lifecycle-core-qWFx-YFM.js";
import { c as buildPlatformRuntimeLogHints, l as buildPlatformServiceStartHints, u as formatRuntimeStatus } from "./systemd-hints-BRnx3cm_.js";
import { t as parsePort } from "./parse-port-Cv54hy6L.js";
import { t as resolveNodeService } from "./node-service-ZKIHeWjw.js";
//#region src/node-host/config.ts
async function loadNodeHostConfig() {
	return {};
}
//#endregion
//#region src/node-host/runner.ts
async function runNodeHost() {
	throw new Error("Node host is unavailable in this trimmed build.");
}
//#endregion
//#region src/commands/node-daemon-install-helpers.ts
async function buildNodeInstallPlan(params) {
	const { devMode, nodePath } = await resolveDaemonInstallRuntimeInputs({
		env: params.env,
		runtime: params.runtime,
		devMode: params.devMode,
		nodePath: params.nodePath
	});
	const { programArguments, workingDirectory } = await resolveNodeProgramArguments({
		host: params.host,
		port: params.port,
		tls: params.tls,
		tlsFingerprint: params.tlsFingerprint,
		nodeId: params.nodeId,
		displayName: params.displayName,
		dev: devMode,
		runtime: params.runtime,
		nodePath
	});
	await emitDaemonInstallRuntimeWarning({
		env: params.env,
		runtime: params.runtime,
		programArguments,
		warn: params.warn,
		title: "Node daemon runtime"
	});
	const environment = buildNodeServiceEnvironment({ env: params.env });
	return {
		programArguments,
		workingDirectory,
		environment,
		description: formatNodeServiceDescription({ version: environment.OPENCLAW_SERVICE_VERSION })
	};
}
//#endregion
//#region src/commands/node-daemon-runtime.ts
const DEFAULT_NODE_DAEMON_RUNTIME = DEFAULT_GATEWAY_DAEMON_RUNTIME;
function isNodeDaemonRuntime(value) {
	return isGatewayDaemonRuntime(value);
}
//#endregion
//#region src/cli/node-cli/daemon.ts
function renderNodeServiceStartHints() {
	return buildPlatformServiceStartHints({
		installCommand: formatCliCommand("openclaw node install"),
		startCommand: formatCliCommand("openclaw node start"),
		launchAgentPlistPath: `~/Library/LaunchAgents/${resolveNodeLaunchAgentLabel()}.plist`,
		systemdServiceName: resolveNodeSystemdServiceName(),
		windowsTaskName: resolveNodeWindowsTaskName()
	});
}
function buildNodeRuntimeHints(env = process.env) {
	return buildPlatformRuntimeLogHints({
		env,
		systemdServiceName: resolveNodeSystemdServiceName(),
		windowsTaskName: resolveNodeWindowsTaskName()
	});
}
function resolveNodeDefaults(opts, config) {
	const host = opts.host?.trim() || config?.gateway?.host || "127.0.0.1";
	const portOverride = parsePort(opts.port);
	if (opts.port !== void 0 && portOverride === null) return {
		host,
		port: null
	};
	return {
		host,
		port: portOverride ?? config?.gateway?.port ?? 18789
	};
}
async function runNodeDaemonInstall(opts) {
	const { json, stdout, warnings, emit, fail } = createDaemonInstallActionContext(opts.json);
	if (failIfNixDaemonInstallMode(fail)) return;
	const config = await loadNodeHostConfig();
	const { host, port } = resolveNodeDefaults(opts, config);
	if (!Number.isFinite(port ?? NaN) || (port ?? 0) <= 0) {
		fail("Invalid port");
		return;
	}
	const runtimeRaw = opts.runtime ? String(opts.runtime) : DEFAULT_NODE_DAEMON_RUNTIME;
	if (!isNodeDaemonRuntime(runtimeRaw)) {
		fail("Invalid --runtime (use \"node\" or \"bun\")");
		return;
	}
	const service = resolveNodeService();
	let loaded = false;
	try {
		loaded = await service.isLoaded({ env: process.env });
	} catch (err) {
		fail(`Node service check failed: ${String(err)}`);
		return;
	}
	if (loaded && !opts.force) {
		emit({
			ok: true,
			result: "already-installed",
			message: `Node service already ${service.loadedText}.`,
			service: buildDaemonServiceSnapshot(service, loaded),
			warnings: warnings.length ? warnings : void 0
		});
		if (!json) {
			defaultRuntime.log(`Node service already ${service.loadedText}.`);
			defaultRuntime.log(`Reinstall with: ${formatCliCommand("openclaw node install --force")}`);
		}
		return;
	}
	const tlsFingerprint = opts.tlsFingerprint?.trim() || config?.gateway?.tlsFingerprint;
	const tls = Boolean(opts.tls) || Boolean(tlsFingerprint) || Boolean(config?.gateway?.tls);
	const { programArguments, workingDirectory, environment, description } = await buildNodeInstallPlan({
		env: process.env,
		host,
		port: port ?? 18789,
		tls,
		tlsFingerprint: tlsFingerprint || void 0,
		nodeId: opts.nodeId,
		displayName: opts.displayName,
		runtime: runtimeRaw,
		warn: (message) => {
			if (json) warnings.push(message);
			else defaultRuntime.log(message);
		}
	});
	await installDaemonServiceAndEmit({
		serviceNoun: "Node",
		service,
		warnings,
		emit,
		fail,
		install: async () => {
			await service.install({
				env: process.env,
				stdout,
				programArguments,
				workingDirectory,
				environment,
				description
			});
		}
	});
}
async function runNodeDaemonUninstall(opts = {}) {
	return await runServiceUninstall({
		serviceNoun: "Node",
		service: resolveNodeService(),
		opts,
		stopBeforeUninstall: false,
		assertNotLoadedAfterUninstall: false
	});
}
async function runNodeDaemonRestart(opts = {}) {
	await runServiceRestart({
		serviceNoun: "Node",
		service: resolveNodeService(),
		renderStartHints: renderNodeServiceStartHints,
		opts
	});
}
async function runNodeDaemonStop(opts = {}) {
	return await runServiceStop({
		serviceNoun: "Node",
		service: resolveNodeService(),
		opts
	});
}
async function runNodeDaemonStatus(opts = {}) {
	const json = Boolean(opts.json);
	const service = resolveNodeService();
	const [loaded, command, runtime] = await Promise.all([
		service.isLoaded({ env: process.env }).catch(() => false),
		service.readCommand(process.env).catch(() => null),
		service.readRuntime(process.env).catch((err) => ({
			status: "unknown",
			detail: String(err)
		}))
	]);
	const payload = { service: {
		...buildDaemonServiceSnapshot(service, loaded),
		command,
		runtime
	} };
	if (json) {
		defaultRuntime.log(JSON.stringify(payload, null, 2));
		return;
	}
	const { rich, label, accent, infoText, okText, warnText, errorText } = createCliStatusTextStyles();
	const serviceStatus = loaded ? okText(service.loadedText) : warnText(service.notLoadedText);
	defaultRuntime.log(`${label("Service:")} ${accent(service.label)} (${serviceStatus})`);
	if (command?.programArguments?.length) defaultRuntime.log(`${label("Command:")} ${infoText(command.programArguments.join(" "))}`);
	if (command?.sourcePath) defaultRuntime.log(`${label("Service file:")} ${infoText(command.sourcePath)}`);
	if (command?.workingDirectory) defaultRuntime.log(`${label("Working dir:")} ${infoText(command.workingDirectory)}`);
	const runtimeLine = formatRuntimeStatus(runtime);
	if (runtimeLine) {
		const runtimeColor = resolveRuntimeStatusColor(runtime?.status);
		defaultRuntime.log(`${label("Runtime:")} ${colorize(rich, runtimeColor, runtimeLine)}`);
	}
	if (!loaded) {
		defaultRuntime.log("");
		for (const hint of renderNodeServiceStartHints()) defaultRuntime.log(`${warnText("Start with:")} ${infoText(hint)}`);
		return;
	}
	const baseEnv = {
		...process.env,
		...command?.environment ?? void 0
	};
	const hintEnv = {
		...baseEnv,
		OPENCLAW_LOG_PREFIX: baseEnv.OPENCLAW_LOG_PREFIX ?? "node"
	};
	if (runtime?.missingUnit) {
		defaultRuntime.error(errorText("Service unit not found."));
		for (const hint of buildNodeRuntimeHints(hintEnv)) defaultRuntime.error(errorText(hint));
		return;
	}
	if (runtime?.status === "stopped") {
		defaultRuntime.error(errorText("Service is loaded but not running."));
		for (const hint of buildNodeRuntimeHints(hintEnv)) defaultRuntime.error(errorText(hint));
	}
}
//#endregion
//#region src/cli/node-cli/register.ts
function parsePortWithFallback(value, fallback) {
	return parsePort(value) ?? fallback;
}
function registerNodeCli(program) {
	const node = program.command("node").description("Run and manage the headless node host service").addHelpText("after", () => `\n${theme.heading("Examples:")}\n${formatHelpExamples([
		["openclaw node run --host 127.0.0.1 --port 18789", "Run the node host in the foreground."],
		["openclaw node status", "Check node host service status."],
		["openclaw node install", "Install the node host service."],
		["openclaw node restart", "Restart the installed node host service."]
	])}\n\n${theme.muted("Docs:")} ${formatDocsLink("/cli/node", "docs.openclaw.ai/cli/node")}\n`);
	node.command("run").description("Run the headless node host (foreground)").option("--host <host>", "Gateway host").option("--port <port>", "Gateway port").option("--tls", "Use TLS for the gateway connection", false).option("--tls-fingerprint <sha256>", "Expected TLS certificate fingerprint (sha256)").option("--node-id <id>", "Override node id (clears pairing token)").option("--display-name <name>", "Override node display name").action(async (opts) => {
		const existing = await loadNodeHostConfig();
		await runNodeHost({
			gatewayHost: opts.host?.trim() || existing?.gateway?.host || "127.0.0.1",
			gatewayPort: parsePortWithFallback(opts.port, existing?.gateway?.port ?? 18789),
			gatewayTls: Boolean(opts.tls) || Boolean(opts.tlsFingerprint),
			gatewayTlsFingerprint: opts.tlsFingerprint,
			nodeId: opts.nodeId,
			displayName: opts.displayName
		});
	});
	node.command("status").description("Show node host status").option("--json", "Output JSON", false).action(async (opts) => {
		await runNodeDaemonStatus(opts);
	});
	node.command("install").description("Install the node host service (launchd/systemd/schtasks)").option("--host <host>", "Gateway host").option("--port <port>", "Gateway port").option("--tls", "Use TLS for the gateway connection", false).option("--tls-fingerprint <sha256>", "Expected TLS certificate fingerprint (sha256)").option("--node-id <id>", "Override node id (clears pairing token)").option("--display-name <name>", "Override node display name").option("--runtime <runtime>", "Service runtime (node|bun). Default: node").option("--force", "Reinstall/overwrite if already installed", false).option("--json", "Output JSON", false).action(async (opts) => {
		await runNodeDaemonInstall(opts);
	});
	node.command("uninstall").description("Uninstall the node host service (launchd/systemd/schtasks)").option("--json", "Output JSON", false).action(async (opts) => {
		await runNodeDaemonUninstall(opts);
	});
	node.command("stop").description("Stop the node host service (launchd/systemd/schtasks)").option("--json", "Output JSON", false).action(async (opts) => {
		await runNodeDaemonStop(opts);
	});
	node.command("restart").description("Restart the node host service (launchd/systemd/schtasks)").option("--json", "Output JSON", false).action(async (opts) => {
		await runNodeDaemonRestart(opts);
	});
}
//#endregion
export { registerNodeCli };
