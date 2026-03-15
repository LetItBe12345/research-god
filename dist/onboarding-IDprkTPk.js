import { u as resolveGatewayPort } from "./paths-tuenh9TL.js";
import { f as defaultRuntime } from "./subsystem-C5Ov5Tl6.js";
import { g as resolveUserPath } from "./utils-J_jJJlhx.js";
import { am as readConfigFileSnapshot, lm as writeConfigFile } from "./reply-BJBzAldK.js";
import { t as formatCliCommand } from "./command-format-CEAcyghQ.js";
import { t as WizardCancelledError } from "./prompts-Cspku7ic.js";
//#region src/wizard/onboarding.ts
async function requireRiskAcknowledgement(params) {
	if (params.opts.acceptRisk === true) return;
	await params.prompter.note([
		"Security warning — please read.",
		"",
		"OpenClaw is a hobby project and still in beta. Expect sharp edges.",
		"By default, OpenClaw is a personal agent: one trusted operator boundary.",
		"This bot can read files and run actions if tools are enabled.",
		"A bad prompt can trick it into doing unsafe things.",
		"",
		"OpenClaw is not a hostile multi-tenant boundary by default.",
		"If multiple users can message one tool-enabled agent, they share that delegated tool authority.",
		"",
		"If you’re not comfortable with security hardening and access control, don’t run OpenClaw.",
		"Ask someone experienced to help before enabling tools or exposing it to the internet.",
		"",
		"Recommended baseline:",
		"- Pairing/allowlists + mention gating.",
		"- Multi-user/shared inbox: split trust boundaries (separate gateway/credentials, ideally separate OS users/hosts).",
		"- Sandbox + least-privilege tools.",
		"- Shared inboxes: isolate DM sessions (`session.dmScope: per-channel-peer`) and keep tool access minimal.",
		"- Keep secrets out of the agent’s reachable filesystem.",
		"- Use the strongest available model for any bot with tools or untrusted inboxes.",
		"",
		"Run regularly:",
		"openclaw security audit --deep",
		"openclaw security audit --fix",
		"",
		"Must read: https://docs.openclaw.ai/gateway/security"
	].join("\n"), "Security");
	if (!await params.prompter.confirm({
		message: "I understand this is personal-by-default and shared/multi-user use requires lock-down. Continue?",
		initialValue: false
	})) throw new WizardCancelledError("risk not accepted");
}
async function runOnboardingWizard(opts, runtime = defaultRuntime, prompter) {
	const onboardHelpers = await import("./onboard-helpers-BEzP-_2l.js").then((n) => n.d);
	onboardHelpers.printWizardHeader(runtime);
	await prompter.intro("OpenClaw onboarding");
	await requireRiskAcknowledgement({
		opts,
		prompter
	});
	const snapshot = await readConfigFileSnapshot();
	let baseConfig = snapshot.valid ? snapshot.exists ? snapshot.config : {} : {};
	if (snapshot.exists && !snapshot.valid) {
		await prompter.note(onboardHelpers.summarizeExistingConfig(baseConfig), "Invalid config");
		if (snapshot.issues.length > 0) await prompter.note([
			...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
			"",
			"Docs: https://docs.openclaw.ai/gateway/configuration"
		].join("\n"), "Config issues");
		await prompter.outro(`Config invalid. Run \`${formatCliCommand("openclaw doctor")}\` to repair it, then re-run onboarding.`);
		runtime.exit(1);
		return;
	}
	const flow = "quickstart";
	if (snapshot.exists) {
		await prompter.note(onboardHelpers.summarizeExistingConfig(baseConfig), "Existing config detected");
		if (await prompter.select({
			message: "Config handling",
			options: [
				{
					value: "keep",
					label: "Use existing values"
				},
				{
					value: "modify",
					label: "Update values"
				},
				{
					value: "reset",
					label: "Reset"
				}
			]
		}) === "reset") {
			const workspaceDefault = baseConfig.agents?.defaults?.workspace ?? onboardHelpers.DEFAULT_WORKSPACE;
			const resetScope = await prompter.select({
				message: "Reset scope",
				options: [
					{
						value: "config",
						label: "Config only"
					},
					{
						value: "config+creds+sessions",
						label: "Config + creds + sessions"
					},
					{
						value: "full",
						label: "Full reset (config + creds + sessions + workspace)"
					}
				]
			});
			await onboardHelpers.handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
			baseConfig = {};
		}
	}
	const quickstartGateway = (() => {
		const hasExisting = typeof baseConfig.gateway?.port === "number" || baseConfig.gateway?.bind !== void 0 || baseConfig.gateway?.auth?.mode !== void 0 || baseConfig.gateway?.auth?.token !== void 0 || baseConfig.gateway?.auth?.password !== void 0 || baseConfig.gateway?.customBindHost !== void 0 || baseConfig.gateway?.tailscale?.mode !== void 0;
		let authMode = "token";
		if (baseConfig.gateway?.auth?.mode === "token" || baseConfig.gateway?.auth?.mode === "password") authMode = baseConfig.gateway.auth.mode;
		else if (baseConfig.gateway?.auth?.token) authMode = "token";
		else if (baseConfig.gateway?.auth?.password) authMode = "password";
		return {
			hasExisting,
			port: resolveGatewayPort(baseConfig),
			bind: "loopback",
			authMode,
			tailscaleMode: "off",
			token: baseConfig.gateway?.auth?.token,
			password: baseConfig.gateway?.auth?.password,
			customBindHost: void 0,
			tailscaleResetOnExit: false
		};
	})();
	const mode = "local";
	await prompter.note([
		`Gateway port: ${quickstartGateway.port || 18789}`,
		"Gateway bind: Loopback (127.0.0.1)",
		quickstartGateway.authMode === "password" ? "Gateway auth: Password" : "Gateway auth: Token (default)",
		"Tailscale exposure: Off",
		"Remote gateway: Disabled"
	].join("\n"), "Local gateway");
	const workspaceDir = resolveUserPath((opts.workspace ?? (flow === "quickstart" ? baseConfig.agents?.defaults?.workspace ?? onboardHelpers.DEFAULT_WORKSPACE : await prompter.text({
		message: "Workspace directory",
		initialValue: baseConfig.agents?.defaults?.workspace ?? onboardHelpers.DEFAULT_WORKSPACE
	}))).trim() || onboardHelpers.DEFAULT_WORKSPACE);
	const { applyOnboardingLocalWorkspaceConfig } = await import("./onboard-config-CuSrWJqb.js").then((n) => n.n);
	let nextConfig = applyOnboardingLocalWorkspaceConfig(baseConfig, workspaceDir);
	const { ensureAuthProfileStore } = await import("./auth-profiles.runtime-5ktsMEWm.js");
	const { promptAuthChoiceGrouped } = await import("./auth-choice-prompt-DRiWSVsZ.js").then((n) => n.t);
	const { promptCustomApiConfig } = await import("./onboard-custom-D69VnmPk.js").then((n) => n.r);
	const { applyAuthChoice, resolvePreferredProviderForAuthChoice, warnIfModelConfigLooksOff } = await import("./auth-choice-2wkZ7IrH.js").then((n) => n.t);
	const { applyPrimaryModel, promptDefaultModel } = await import("./model-picker-DYEdKdlD.js").then((n) => n.i);
	const authStore = ensureAuthProfileStore(void 0, { allowKeychainPrompt: false });
	const authChoiceFromPrompt = opts.authChoice === void 0;
	const authChoice = opts.authChoice ?? await promptAuthChoiceGrouped({
		prompter,
		store: authStore,
		includeSkip: true,
		config: nextConfig,
		workspaceDir
	});
	if (authChoice === "custom-api-key") nextConfig = (await promptCustomApiConfig({
		prompter,
		runtime,
		config: nextConfig,
		secretInputMode: opts.secretInputMode
	})).config;
	else {
		const authResult = await applyAuthChoice({
			authChoice,
			config: nextConfig,
			prompter,
			runtime,
			setDefaultModel: true,
			opts: {
				tokenProvider: opts.tokenProvider,
				token: opts.authChoice === "apiKey" && opts.token ? opts.token : void 0
			}
		});
		nextConfig = authResult.config;
		if (authResult.agentModelOverride) nextConfig = applyPrimaryModel(nextConfig, authResult.agentModelOverride);
	}
	if (authChoiceFromPrompt && authChoice !== "custom-api-key") {
		const modelSelection = await promptDefaultModel({
			config: nextConfig,
			prompter,
			allowKeep: true,
			ignoreAllowlist: true,
			includeProviderPluginSetups: true,
			preferredProvider: resolvePreferredProviderForAuthChoice({
				choice: authChoice,
				config: nextConfig,
				workspaceDir
			}),
			workspaceDir,
			runtime
		});
		if (modelSelection.config) nextConfig = modelSelection.config;
		if (modelSelection.model) nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
	}
	await warnIfModelConfigLooksOff(nextConfig, prompter);
	const { configureGatewayForOnboarding } = await import("./onboarding.gateway-config-Dfv540SX.js");
	const gateway = await configureGatewayForOnboarding({
		flow,
		baseConfig,
		nextConfig,
		localPort: quickstartGateway.port,
		quickstartGateway,
		secretInputMode: opts.secretInputMode,
		prompter,
		runtime
	});
	nextConfig = {
		...gateway.nextConfig,
		gateway: {
			...gateway.nextConfig.gateway,
			mode: "local",
			bind: "loopback",
			customBindHost: void 0,
			remote: void 0,
			tailscale: {
				...gateway.nextConfig.gateway?.tailscale,
				mode: "off",
				resetOnExit: false
			}
		}
	};
	const settings = gateway.settings;
	await writeConfigFile(nextConfig);
	const { logConfigUpdated } = await import("./logging-BbQr4Z2M.js").then((n) => n.r);
	logConfigUpdated(runtime);
	await onboardHelpers.ensureWorkspaceAndSessions(workspaceDir, runtime, { skipBootstrap: true });
	const { setupInternalHooks } = await import("./onboard-hooks-BOoza2iI.js");
	nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);
	nextConfig = onboardHelpers.applyWizardMetadata(nextConfig, {
		command: "onboard",
		mode
	});
	await writeConfigFile(nextConfig);
	const { finalizeOnboardingWizard } = await import("./onboarding.finalize-BzjCL6Uf.js");
	const { launchedTui } = await finalizeOnboardingWizard({
		flow,
		opts,
		baseConfig,
		nextConfig,
		workspaceDir,
		settings,
		prompter,
		runtime
	});
	if (launchedTui) return;
}
//#endregion
export { runOnboardingWizard as t };
