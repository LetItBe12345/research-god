export declare function readChannelAllowFromStore(channel?: string, env?: NodeJS.ProcessEnv, accountId?: string): Promise<string[]>;
export declare function readChannelAllowFromStoreSync(channel?: string, env?: NodeJS.ProcessEnv, accountId?: string): string[];
export declare function upsertChannelPairingRequest(_params: {
    channel: string;
    id: string;
    accountId?: string;
    meta?: unknown;
    env?: NodeJS.ProcessEnv;
    pairingAdapter?: unknown;
}): Promise<{
    code: string;
    created: boolean;
}>;
export declare function listChannelPairingRequests(_channel: string, _env?: NodeJS.ProcessEnv, _accountId?: string): Promise<Array<{
    code: string;
    id: string;
    meta?: unknown;
    createdAt: string;
}>>;
export declare function approveChannelPairingCode(_params: {
    channel: string;
    code: string;
    accountId?: string;
}): Promise<{
    code: string;
    id: string;
} | null>;
export declare function addChannelAllowFromStoreEntry(_params: {
    channel: string;
    entry: string;
    accountId?: string;
}): Promise<void>;
export declare function removeChannelAllowFromStoreEntry(_params: {
    channel: string;
    entry: string;
    accountId?: string;
}): Promise<void>;
export declare function resolveChannelAllowFromPath(channel: string, env?: NodeJS.ProcessEnv, accountId?: string): string;
