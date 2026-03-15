import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ChannelMessageActionContext } from "../../types.js";
export declare function handleDiscordMessageAction(params: ChannelMessageActionContext & {
    invoke?: (params: Record<string, unknown>, cfg: ChannelMessageActionContext["cfg"], options?: {
        mediaLocalRoots?: readonly string[];
    }) => Promise<AgentToolResult<unknown>>;
}): Promise<AgentToolResult<unknown>>;
