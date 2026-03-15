import type { OpenClawConfig } from "../../../config/config.js";
import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingStatus,
  ChannelOnboardingStatusContext,
} from "../onboarding-types.js";

const channel = "telegram" as const;

function buildUnavailableStatus(_cfg: OpenClawConfig): ChannelOnboardingStatus {
  return {
    channel,
    configured: false,
    statusLines: ["Telegram: unavailable in this trimmed build"],
    selectionHint: "disabled in trimmed build",
    quickstartScore: 0,
  };
}

export const telegramOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }: ChannelOnboardingStatusContext) => buildUnavailableStatus(cfg),
  configure: async ({ cfg, prompter }) => {
    await prompter.note(
      "Telegram onboarding is unavailable in this trimmed build.",
      "Telegram unavailable",
    );
    return { cfg };
  },
  disable: (cfg) => cfg,
};
