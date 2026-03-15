import "./paths-tuenh9TL.js";
import "./subsystem-C5Ov5Tl6.js";
import "./utils-J_jJJlhx.js";
import "./reply-BJBzAldK.js";
import "./agent-scope-mSwAEzsR.js";
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
import "./paths-CCtAY9XW.js";
import "./session-cost-usage-CPJEuaoV.js";
import "./links-CQdKVoyv.js";
import "./cli-utils-DOT-XcGX.js";
import "./runtime-guard-o6VhvYRO.js";
import "./daemon-install-plan.shared-DFF_DjEl.js";
import { n as buildGatewayInstallPlan, r as gatewayInstallErrorHint, t as resolveGatewayInstallToken } from "./gateway-install-token-D1P6RtKd.js";
import { r as isGatewayDaemonRuntime } from "./daemon-runtime-3pRKLH22.js";
import "./onboard-helpers-BEzP-_2l.js";
import "./prompt-style-CuhBzfSK.js";
import "./runtime-parse-Bv9AO30b.js";
import "./launchd-DNJatA35.js";
import { n as resolveGatewayService } from "./service-ChJv9xB3.js";
import { i as isSystemdUserServiceAvailable } from "./systemd-Q_z7_aO1.js";
import "./note-heSZB4P7.js";
import { n as ensureSystemdUserLingerNonInteractive } from "./systemd-linger-DKaZ5KRi.js";
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
