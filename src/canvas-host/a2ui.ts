import type { IncomingMessage, ServerResponse } from "node:http";

export const A2UI_PATH = "/a2ui";
export const CANVAS_HOST_PATH = "/canvas";
export const CANVAS_WS_PATH = "/canvas/ws";

export async function handleA2uiHttpRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = 404;
  res.end("Canvas host is unavailable in this trimmed build.");
}
