import type { OpenClawConfig } from "../../../config/config.js";
import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingStatus,
  ChannelOnboardingStatusContext,
} from "../onboarding-types.js";

const channel = "whatsapp" as const;

function buildUnavailableStatus(_cfg: OpenClawConfig): ChannelOnboardingStatus {
  return {
    channel,
    configured: false,
    statusLines: ["WhatsApp onboarding: unavailable in this trimmed build"],
    selectionHint: "disabled in trimmed build",
    quickstartScore: 0,
  };
}

export const whatsappOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }: ChannelOnboardingStatusContext) => buildUnavailableStatus(cfg),
  configure: async ({ cfg, prompter }) => {
    await prompter.note(
      "WhatsApp onboarding is unavailable in this trimmed build.",
      "WhatsApp unavailable",
    );
    return { cfg };
  },
  disable: (cfg) => cfg,
};
