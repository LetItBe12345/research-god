export type ProcessedLineMessage = {
  messages: Array<Record<string, unknown>>;
};

export function stripMarkdown(value: string): string {
  return value;
}

export function processLineMessage(text: string): ProcessedLineMessage {
  return {
    messages: [{ type: "text", text }],
  };
}
