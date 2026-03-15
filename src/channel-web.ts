const unsupported = (feature: string): never => {
  throw new Error(`${feature} is unavailable in this trimmed build.`);
};

export const DEFAULT_WEB_MEDIA_BYTES = 0;
export const HEARTBEAT_PROMPT = "";
export const HEARTBEAT_TOKEN = "";
export const WA_WEB_AUTH_DIR = ".openclaw/disabled-whatsapp";

export type WebChannelStatus = "disabled";
export type WebMonitorTuning = Record<string, never>;
export type WebInboundMessage = Record<string, never>;
export type WebListenerCloseReason = "disabled";

export async function monitorWebChannel(): Promise<never> {
  return unsupported("WhatsApp web monitoring");
}

export function resolveHeartbeatRecipients(): string[] {
  return [];
}

export async function runWebHeartbeatOnce(): Promise<void> {}

export function extractMediaPlaceholder(): undefined {
  return undefined;
}

export function extractText(): string {
  return "";
}

export async function monitorWebInbox(): Promise<never> {
  return unsupported("WhatsApp web inbox");
}

export async function loginWeb(): Promise<never> {
  return unsupported("WhatsApp login");
}

export async function loadWebMedia(): Promise<never> {
  return unsupported("WhatsApp media loading");
}

export async function optimizeImageToJpeg(): Promise<never> {
  return unsupported("WhatsApp media optimization");
}

export async function sendMessageWhatsApp(): Promise<never> {
  return unsupported("WhatsApp send");
}

export function createWaSocket(): never {
  return unsupported("WhatsApp socket");
}

export function formatError(error: unknown): string {
  return String(error);
}

export function getStatusCode(): undefined {
  return undefined;
}

export async function logoutWeb(): Promise<void> {}

export async function logWebSelfId(): Promise<void> {}

export function pickWebChannel(): undefined {
  return undefined;
}

export async function waitForWaConnection(): Promise<never> {
  return unsupported("WhatsApp connection wait");
}

export function webAuthExists(): boolean {
  return false;
}
