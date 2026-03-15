import "./subsystem-C1ZwgyXv.js";
import "./paths-dQ_clcF4.js";
import "./boolean-BHdNsbzF.js";
import "./auth-profiles-DZ4zIQH4.js";
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
import "./links-BmJbo-zG.js";
import "./cli-utils-Cc7goTOv.js";
import "./daemon-install-plan.shared-Cp3Ohrwt.js";
import "./runtime-guard-J6FFyZo2.js";
import { n as buildGatewayInstallPlan, r as gatewayInstallErrorHint, t as resolveGatewayInstallToken } from "./gateway-install-token-DhQTmVZ8.js";
import { r as isGatewayDaemonRuntime } from "./daemon-runtime-DnPtziIn.js";
import "./onboard-helpers-4CUqO3j0.js";
import "./prompt-style-B3R7Bffy.js";
import "./runtime-parse-pVlvZ5Tt.js";
import "./launchd-BYHD2rMv.js";
import { n as resolveGatewayService } from "./service-B9uQ0VXf.js";
import { i as isSystemdUserServiceAvailable } from "./systemd-BJIjjTO2.js";
import "./note-QL6AfaP7.js";
import { n as ensureSystemdUserLingerNonInteractive } from "./systemd-linger-F1RJTY3g.js";
//#region src/commands/onboard-non-interactive/local/daemon-install.ts
async function installGatewayDaemonNonInteractive(params) {
	const { opts, runtime, port } = params;
	if (!opts.installDaemon) return { installed: false };
	const daemonRuntimeRaw = opts.daemonRuntime ?? "node";
	const systemdAvailable = process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
	if (process.platform === "linux" && !systemdAvailable) {
		runtime.log("Systemd user services are unavailable; skipping service install. Use a direct shell run (`openclaw gateway run`) or rerun without --install-daemon on this session.");
		return {
			installed: false,
			skippedReason: "systemd-user-unavailable"
		};
	}
	if (!isGatewayDaemonRuntime(daemonRuntimeRaw)) {
		runtime.error("Invalid --daemon-runtime (use node or bun)");
		runtime.exit(1);
		return { installed: false };
	}
	const service = resolveGatewayService();
	const tokenResolution = await resolveGatewayInstallToken({
		config: params.nextConfig,
		env: process.env
	});
	for (const warning of tokenResolution.warnings) runtime.log(warning);
	if (tokenResolution.unavailableReason) {
		runtime.error([
			"Gateway install blocked:",
			tokenResolution.unavailableReason,
			"Fix gateway auth config/token input and rerun onboarding."
		].join(" "));
		runtime.exit(1);
		return { installed: false };
	}
	const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan({
		env: process.env,
		port,
		runtime: daemonRuntimeRaw,
		warn: (message) => runtime.log(message),
		config: params.nextConfig
	});
	try {
		await service.install({
			env: process.env,
			stdout: process.stdout,
			programArguments,
			workingDirectory,
			environment
		});
	} catch (err) {
		runtime.error(`Gateway service install failed: ${String(err)}`);
		runtime.log(gatewayInstallErrorHint());
		return { installed: false };
	}
	await ensureSystemdUserLingerNonInteractive({ runtime });
	return { installed: true };
}
//#endregion
export { installGatewayDaemonNonInteractive };
