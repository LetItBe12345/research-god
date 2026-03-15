import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDeps } from "./deps.js";

const moduleLoads = vi.hoisted(() => ({
  whatsapp: vi.fn(),
  telegram: vi.fn(),
  discord: vi.fn(),
  slack: vi.fn(),
  signal: vi.fn(),
  imessage: vi.fn(),
}));

const sendFns = vi.hoisted(() => ({
  whatsapp: vi.fn(async () => ({ messageId: "w1", toJid: "whatsapp:1" })),
  telegram: vi.fn(async () => ({ messageId: "t1", chatId: "telegram:1" })),
  discord: vi.fn(async () => ({ messageId: "d1", channelId: "discord:1" })),
  slack: vi.fn(async () => ({ messageId: "s1", channelId: "slack:1" })),
  signal: vi.fn(async () => ({ messageId: "sg1", conversationId: "signal:1" })),
  imessage: vi.fn(async () => ({ messageId: "i1", chatId: "imessage:1" })),
}));

vi.mock("../channels/web/index.js", () => {
  moduleLoads.whatsapp();
  return { sendMessageWhatsApp: sendFns.whatsapp };
});

vi.mock("../../extensions/telegram/src/send.js", () => {
  moduleLoads.telegram();
  return { sendMessageTelegram: sendFns.telegram };
});

vi.mock("../../extensions/discord/src/send.js", () => {
  moduleLoads.discord();
  return { sendMessageDiscord: sendFns.discord };
});

vi.mock("../../extensions/slack/src/send.js", () => {
  moduleLoads.slack();
  return { sendMessageSlack: sendFns.slack };
});

vi.mock("../../extensions/signal/src/send.js", () => {
  moduleLoads.signal();
  return { sendMessageSignal: sendFns.signal };
});

vi.mock("../../extensions/imessage/src/send.js", () => {
  moduleLoads.imessage();
  return { sendMessageIMessage: sendFns.imessage };
});

describe("createDefaultDeps", () => {
  function expectUnusedModulesNotLoaded(exclude: keyof typeof moduleLoads): void {
    const keys = Object.keys(moduleLoads) as Array<keyof typeof moduleLoads>;
    for (const key of keys) {
      if (key === exclude) {
        continue;
      }
      expect(moduleLoads[key]).not.toHaveBeenCalled();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns disabled senders without loading provider modules", async () => {
    const deps = createDefaultDeps();

    expect(moduleLoads.whatsapp).not.toHaveBeenCalled();
    expect(moduleLoads.telegram).not.toHaveBeenCalled();
    expect(moduleLoads.discord).not.toHaveBeenCalled();
    expect(moduleLoads.slack).not.toHaveBeenCalled();
    expect(moduleLoads.signal).not.toHaveBeenCalled();
    expect(moduleLoads.imessage).not.toHaveBeenCalled();

    const sendTelegram = deps["telegram"] as (...args: unknown[]) => Promise<unknown>;
    await expect(sendTelegram("chat", "hello", { verbose: false })).rejects.toThrow(
      /telegram send is unavailable/i,
    );

    expectUnusedModulesNotLoaded("telegram");
  });

  it("keeps disabled senders deterministic across repeated calls", async () => {
    const deps = createDefaultDeps();
    const sendDiscord = deps["discord"] as (...args: unknown[]) => Promise<unknown>;

    await expect(sendDiscord("channel", "first", { verbose: false })).rejects.toThrow(
      /discord send is unavailable/i,
    );
    await expect(sendDiscord("channel", "second", { verbose: false })).rejects.toThrow(
      /discord send is unavailable/i,
    );

    expect(moduleLoads.discord).not.toHaveBeenCalled();
  });
});
