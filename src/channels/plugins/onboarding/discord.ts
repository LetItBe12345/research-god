import type { OpenClawConfig } from "../../../config/config.js";
import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingStatus,
  ChannelOnboardingStatusContext,
} from "../onboarding-types.js";

const channel = "discord" as const;

function buildUnavailableStatus(_cfg: OpenClawConfig): ChannelOnboardingStatus {
  return {
    channel,
    configured: false,
    statusLines: ["Discord: unavailable in this trimmed build"],
    selectionHint: "disabled in trimmed build",
    quickstartScore: 0,
  };
}

export const discordOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }: ChannelOnboardingStatusContext) => buildUnavailableStatus(cfg),
  configure: async ({ cfg, prompter }) => {
    await prompter.note(
      "Discord onboarding is unavailable in this trimmed build.",
      "Discord unavailable",
    );
    return { cfg };
  },
  disable: (cfg) => cfg,
};
