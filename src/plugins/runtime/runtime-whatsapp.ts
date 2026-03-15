import { createWhatsAppLoginTool } from "../../channels/plugins/agent-tools/whatsapp-login.js";
import type { PluginRuntime } from "./types.js";
const unsupported = (feature: string): never => {
  throw new Error(`${feature} is unavailable in this trimmed build.`);
};

export function createRuntimeWhatsApp(): PluginRuntime["channel"]["whatsapp"] {
  return {
    getActiveWebListener: (() => undefined) as PluginRuntime["channel"]["whatsapp"]["getActiveWebListener"],
    getWebAuthAgeMs: (() => undefined) as PluginRuntime["channel"]["whatsapp"]["getWebAuthAgeMs"],
    logoutWeb: (async () => {}) as PluginRuntime["channel"]["whatsapp"]["logoutWeb"],
    logWebSelfId: (async () => {}) as PluginRuntime["channel"]["whatsapp"]["logWebSelfId"],
    readWebSelfId: (() => undefined) as PluginRuntime["channel"]["whatsapp"]["readWebSelfId"],
    webAuthExists: (() => false) as PluginRuntime["channel"]["whatsapp"]["webAuthExists"],
    sendMessageWhatsApp: (async () => unsupported("WhatsApp outbound")) as PluginRuntime["channel"]["whatsapp"]["sendMessageWhatsApp"],
    sendPollWhatsApp: (async () => unsupported("WhatsApp poll")) as PluginRuntime["channel"]["whatsapp"]["sendPollWhatsApp"],
    loginWeb: (async () => unsupported("WhatsApp login")) as PluginRuntime["channel"]["whatsapp"]["loginWeb"],
    startWebLoginWithQr: (async () =>
      unsupported("WhatsApp QR login")) as PluginRuntime["channel"]["whatsapp"]["startWebLoginWithQr"],
    waitForWebLogin: (async () =>
      unsupported("WhatsApp QR wait")) as PluginRuntime["channel"]["whatsapp"]["waitForWebLogin"],
    monitorWebChannel: (async () =>
      unsupported("WhatsApp monitor")) as PluginRuntime["channel"]["whatsapp"]["monitorWebChannel"],
    handleWhatsAppAction: (async () =>
      unsupported("WhatsApp actions")) as PluginRuntime["channel"]["whatsapp"]["handleWhatsAppAction"],
    createLoginTool: createWhatsAppLoginTool,
  };
}
