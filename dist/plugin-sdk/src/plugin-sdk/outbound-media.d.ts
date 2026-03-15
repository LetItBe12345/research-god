export type OutboundMediaLoadOptions = {
    maxBytes?: number;
    mediaLocalRoots?: readonly string[];
};
export declare function loadOutboundMediaFromUrl(mediaUrl: string, options?: OutboundMediaLoadOptions): Promise<import("../media/web-media.js").WebMediaResult>;
