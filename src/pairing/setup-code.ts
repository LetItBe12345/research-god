export function encodePairingSetupCode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload ?? {}), "utf8").toString("base64url");
}

export async function resolvePairingSetupFromConfig(): Promise<{
  payload: Record<string, unknown>;
}> {
  return { payload: {} };
}
