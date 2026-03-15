import { isVoiceCompatibleAudio } from "../../media/audio.js";
import { mediaKindFromMime } from "../../media/constants.js";
import { getImageMetadata, resizeToJpeg } from "../../media/image-ops.js";
import { detectMime } from "../../media/mime.js";
import type { PluginRuntime } from "./types.js";

async function loadWebMediaUnsupported(): Promise<never> {
  throw new Error("WhatsApp media support is unavailable in this trimmed build.");
}

export function createRuntimeMedia(): PluginRuntime["media"] {
  return {
    loadWebMedia: loadWebMediaUnsupported as PluginRuntime["media"]["loadWebMedia"],
    detectMime,
    mediaKindFromMime,
    isVoiceCompatibleAudio,
    getImageMetadata,
    resizeToJpeg,
  };
}
