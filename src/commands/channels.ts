export type { ChannelsListOptions } from "./channels/list.js";
export { channelsListCommand } from "./channels/list.js";
export type { ChannelsLogsOptions } from "./channels/logs.js";
export { channelsLogsCommand } from "./channels/logs.js";
export type { ChannelsResolveOptions } from "./channels/resolve.js";
export { channelsResolveCommand } from "./channels/resolve.js";
export type { ChannelsStatusOptions } from "./channels/status.js";
export { channelsStatusCommand, formatGatewayChannelsStatusLines } from "./channels/status.js";

export type ChannelsAddOptions = Record<string, unknown>;
export type ChannelsCapabilitiesOptions = Record<string, unknown>;
export type ChannelsRemoveOptions = Record<string, unknown>;

function unsupported(): never {
  throw new Error("Channel mutation commands are unavailable in this trimmed build.");
}

export async function channelsAddCommand(): Promise<never> {
  return unsupported();
}

export async function channelsCapabilitiesCommand(): Promise<never> {
  return unsupported();
}

export async function channelsRemoveCommand(): Promise<never> {
  return unsupported();
}
