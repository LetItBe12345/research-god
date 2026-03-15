export { LineConfigSchema } from "../line/config-schema.js";
export type { LineChannelData, LineConfig, ResolvedLineAccount } from "../line/types.js";
export type CardAction = Record<string, unknown>;
export type ListItem = Record<string, unknown>;
export declare function createActionCard(params: Record<string, unknown>): {
    type: string;
    kind: string;
};
export declare function createImageCard(params: Record<string, unknown>): {
    type: string;
    kind: string;
};
export declare function createInfoCard(params: Record<string, unknown>): {
    type: string;
    kind: string;
};
export declare function createListCard(params: Record<string, unknown>): {
    type: string;
    kind: string;
};
export declare function createReceiptCard(params: Record<string, unknown>): {
    type: string;
    kind: string;
};
export declare function processLineMessage(text: string): {
    messages: {
        type: string;
        text: string;
    }[];
};
