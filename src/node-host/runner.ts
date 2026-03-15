export async function runNodeHost(): Promise<never> {
  throw new Error("Node host is unavailable in this trimmed build.");
}
