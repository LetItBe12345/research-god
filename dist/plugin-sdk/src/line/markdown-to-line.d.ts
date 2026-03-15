export type ProcessedLineMessage = {
    messages: Array<Record<string, unknown>>;
};
export declare function stripMarkdown(value: string): string;
export declare function processLineMessage(text: string): ProcessedLineMessage;
