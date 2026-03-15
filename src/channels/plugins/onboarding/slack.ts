import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingStatus,
  ChannelOnboardingStatusContext,
} from "../onboarding-types.js";

const channel = "slack" as const;

function buildUnavailableStatus(_ctx: ChannelOnboardingStatusContext): ChannelOnboardingStatus {
  return {
    channel,
    configured: false,
    statusLines: ["Slack: unavailable in this trimmed build"],
    selectionHint: "disabled in trimmed build",
    quickstartScore: 0,
  };
}

export const slackOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async (ctx) => buildUnavailableStatus(ctx),
  configure: async ({ cfg, prompter }) => {
    await prompter.note("Slack onboarding is unavailable in this trimmed build.", "Slack");
    return { cfg };
  },
  disable: (cfg) => cfg,
};
