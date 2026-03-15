function unsupported(): never {
  throw new Error("WhatsApp outbound is unavailable in this trimmed build.");
}

export async function sendMessageWhatsApp(): Promise<never> {
  return unsupported();
}

export async function sendPollWhatsApp(): Promise<never> {
  return unsupported();
}
