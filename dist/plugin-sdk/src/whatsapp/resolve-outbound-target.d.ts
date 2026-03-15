export declare function resolveWhatsAppOutboundTarget(params: {
    to?: string;
    allowFrom?: readonly string[];
    mode?: "explicit" | "implicit" | "heartbeat";
}): {
    ok: true;
    to: string;
} | {
    ok: false;
    error: Error;
};
