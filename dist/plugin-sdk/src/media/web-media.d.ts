type ReadFileFn = (filePath: string) => Promise<Buffer>;
export type WebMediaLoadOptions = {
    maxBytes?: number;
    localRoots?: readonly string[];
    sandboxValidated?: boolean;
    readFile?: ReadFileFn;
};
export type WebMediaKind = "audio" | "document" | "image" | "video";
export type WebMediaResult = {
    kind: WebMediaKind;
    buffer: Buffer;
    contentType?: string;
    mimeType?: string;
    fileName?: string;
};
export declare function getDefaultLocalRoots(): string[];
export declare function loadWebMediaRaw(source: string, options?: number | WebMediaLoadOptions): Promise<WebMediaResult>;
export declare function loadWebMedia(source: string, options?: number | WebMediaLoadOptions): Promise<WebMediaResult>;
export {};
