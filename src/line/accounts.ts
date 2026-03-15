export function listLineAccountIds(): string[] {
  return [];
}

export function resolveDefaultLineAccountId(): string | undefined {
  return undefined;
}

export function resolveLineAccount(): never {
  throw new Error("LINE is unavailable in this trimmed build.");
}

export function normalizeAccountId(accountId?: string | null): string {
  return accountId?.trim() || "default";
}
