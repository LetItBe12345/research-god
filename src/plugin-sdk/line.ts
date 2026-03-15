export { LineConfigSchema } from "../line/config-schema.js";
export type { LineChannelData, LineConfig, ResolvedLineAccount } from "../line/types.js";

export type CardAction = Record<string, unknown>;
export type ListItem = Record<string, unknown>;

export function createActionCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "action", ...params };
}

export function createImageCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "image", ...params };
}

export function createInfoCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "info", ...params };
}

export function createListCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "list", ...params };
}

export function createReceiptCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "receipt", ...params };
}

export function processLineMessage(text: string) {
  return {
    messages: [{ type: "text", text }],
  };
}
