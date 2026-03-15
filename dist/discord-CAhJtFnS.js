//#region src/channels/plugins/onboarding/discord.ts
const channel = "discord";
function buildUnavailableStatus(_cfg) {
	return {
		channel,
		configured: false,
		statusLines: ["Discord: unavailable in this trimmed build"],
		selectionHint: "disabled in trimmed build",
		quickstartScore: 0
	};
}
const discordOnboardingAdapter = {
	channel,
	getStatus: async ({ cfg }) => buildUnavailableStatus(cfg),
	configure: async ({ cfg, prompter }) => {
		await prompter.note("Discord onboarding is unavailable in this trimmed build.", "Discord unavailable");
		return { cfg };
	},
	disable: (cfg) => cfg
};
//#endregion
export { discordOnboardingAdapter as t };
