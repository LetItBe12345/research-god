import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "../../../whatsapp/normalize.js";
export { isWhatsAppGroupJid, normalizeWhatsAppTarget };
export declare function normalizeWhatsAppMessagingTarget(value: string): string | undefined;
export declare function looksLikeWhatsAppTargetId(value: string): boolean;
export declare function normalizeWhatsAppAllowFromEntries(allowFrom: Array<string | number>): string[];
