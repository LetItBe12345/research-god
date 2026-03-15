export type LineChannelData = {
    quickReplies?: string[];
    location?: {
        title: string;
        address: string;
        latitude: number;
        longitude: number;
    };
    templateMessage?: Record<string, unknown>;
    flexMessage?: {
        altText: string;
        contents: Record<string, unknown>;
    };
};
