import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry, createChannelTestPluginBase } from "../test-utils/channel-plugins.js";
import type { OpenClawConfig } from "../config/config.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import type { ChannelChoice } from "./onboard-types.js";
import { getChannelOnboardingAdapter } from "./onboarding/registry.js";
import type { ChannelOnboardingAdapter } from "./onboarding/types.js";

type ChannelOnboardingAdapterPatch = Partial<
  Pick<
    ChannelOnboardingAdapter,
    "configure" | "configureInteractive" | "configureWhenConfigured" | "getStatus"
  >
>;

type PatchedOnboardingAdapterFields = {
  configure?: ChannelOnboardingAdapter["configure"];
  configureInteractive?: ChannelOnboardingAdapter["configureInteractive"];
  configureWhenConfigured?: ChannelOnboardingAdapter["configureWhenConfigured"];
  getStatus?: ChannelOnboardingAdapter["getStatus"];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function cloneConfig(cfg: OpenClawConfig): OpenClawConfig {
  return structuredClone(cfg);
}

function ensureChannelSection(
  cfg: OpenClawConfig,
  channel: ChannelChoice,
): Record<string, unknown> {
  const channels = (cfg.channels ??= {});
  const existing = asRecord(channels[channel]);
  if (existing) {
    return existing;
  }
  const created: Record<string, unknown> = {};
  channels[channel] = created as never;
  return created;
}

function resolveAccountContainer(
  channelConfig: Record<string, unknown>,
  accountId: string,
): Record<string, unknown> {
  if (accountId === "default" && !asRecord(channelConfig.accounts)) {
    return channelConfig;
  }
  const accounts = asRecord(channelConfig.accounts) ?? {};
  channelConfig.accounts = accounts;
  const existing = asRecord(accounts[accountId]);
  if (existing) {
    return existing;
  }
  const created: Record<string, unknown> = {};
  accounts[accountId] = created;
  return created;
}

function listAccountIdsFromConfig(cfg: OpenClawConfig, channel: ChannelChoice): string[] {
  const channelConfig = asRecord(cfg.channels?.[channel]);
  if (!channelConfig) {
    return [];
  }
  const ids = new Set<string>();
  const accounts = asRecord(channelConfig.accounts);
  if (accounts) {
    for (const id of Object.keys(accounts)) {
      ids.add(id);
    }
  }
  if (Object.keys(channelConfig).some((key) => key !== "accounts")) {
    ids.add("default");
  }
  return [...ids];
}

function setFieldIfPresent(
  target: Record<string, unknown>,
  input: Record<string, unknown>,
  sourceKey: string,
  targetKey = sourceKey,
) {
  const value = input[sourceKey];
  if (value !== undefined) {
    target[targetKey] = value;
  }
}

function createTestChannelPlugin(channel: ChannelChoice): ChannelPlugin {
  const base = createChannelTestPluginBase({ id: channel, label: channel });
  return {
    ...base,
    config: {
      listAccountIds: (cfg) => listAccountIdsFromConfig(cfg, channel),
      resolveAccount: (cfg, accountId) => {
        const channelConfig = asRecord(cfg.channels?.[channel]) ?? {};
        const accounts = asRecord(channelConfig.accounts);
        return (accounts?.[accountId ?? "default"] as Record<string, unknown> | undefined) ?? channelConfig;
      },
      setAccountEnabled: ({ cfg, accountId, enabled }) => {
        const next = cloneConfig(cfg);
        const channelConfig = ensureChannelSection(next, channel);
        const target = resolveAccountContainer(channelConfig, accountId);
        target.enabled = enabled;
        return next;
      },
      deleteAccount: ({ cfg, accountId }) => {
        const next = cloneConfig(cfg);
        const channelConfig = asRecord(next.channels?.[channel]);
        if (!channelConfig) {
          return next;
        }
        if (accountId === "default" && !asRecord(channelConfig.accounts)) {
          delete next.channels?.[channel];
          return next;
        }
        const accounts = asRecord(channelConfig.accounts);
        if (accounts) {
          delete accounts[accountId];
          if (Object.keys(accounts).length === 0) {
            delete channelConfig.accounts;
          }
        }
        return next;
      },
    },
    setup: {
      applyAccountConfig: ({ cfg, accountId, input }) => {
        const next = cloneConfig(cfg);
        const channelConfig = ensureChannelSection(next, channel);
        channelConfig.enabled = true;
        const target = resolveAccountContainer(channelConfig, accountId);
        const rawInput = input as Record<string, unknown>;
        setFieldIfPresent(target, rawInput, "name");
        if (channel === "telegram") {
          setFieldIfPresent(target, rawInput, "token", "botToken");
        }
        if (channel === "discord") {
          setFieldIfPresent(target, rawInput, "token");
        }
        if (channel === "slack") {
          setFieldIfPresent(target, rawInput, "botToken");
          setFieldIfPresent(target, rawInput, "appToken");
        }
        if (channel === "signal") {
          setFieldIfPresent(target, rawInput, "signalNumber", "account");
        }
        if (accountId === "default" && asRecord(channelConfig.accounts)) {
          delete channelConfig.name;
        }
        return next;
      },
    },
  } as ChannelPlugin;
}

export function setDefaultChannelPluginRegistryForTests(): void {
  const channels = ([
    "discord",
    "slack",
    "telegram",
    "whatsapp",
    "signal",
    "imessage",
  ] as const).map((id) => ({
    pluginId: id,
    plugin: createTestChannelPlugin(id),
    source: "test",
  }));
  setActivePluginRegistry(createTestRegistry(channels));
}

export function patchChannelOnboardingAdapter(
  channel: ChannelChoice,
  patch: ChannelOnboardingAdapterPatch,
): () => void {
  const adapter = getChannelOnboardingAdapter(channel);
  if (!adapter) {
    throw new Error(`missing onboarding adapter for ${channel}`);
  }

  const previous: PatchedOnboardingAdapterFields = {};

  if (Object.prototype.hasOwnProperty.call(patch, "getStatus")) {
    previous.getStatus = adapter.getStatus;
    adapter.getStatus = patch.getStatus ?? adapter.getStatus;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "configure")) {
    previous.configure = adapter.configure;
    adapter.configure = patch.configure ?? adapter.configure;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "configureInteractive")) {
    previous.configureInteractive = adapter.configureInteractive;
    adapter.configureInteractive = patch.configureInteractive;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "configureWhenConfigured")) {
    previous.configureWhenConfigured = adapter.configureWhenConfigured;
    adapter.configureWhenConfigured = patch.configureWhenConfigured;
  }

  return () => {
    if (Object.prototype.hasOwnProperty.call(patch, "getStatus")) {
      adapter.getStatus = previous.getStatus!;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "configure")) {
      adapter.configure = previous.configure!;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "configureInteractive")) {
      adapter.configureInteractive = previous.configureInteractive;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "configureWhenConfigured")) {
      adapter.configureWhenConfigured = previous.configureWhenConfigured;
    }
  };
}
