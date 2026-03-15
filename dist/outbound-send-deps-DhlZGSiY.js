//#region src/cli/outbound-send-mapping.ts
const LEGACY_SOURCE_TO_CHANNEL = {
	sendMessageWhatsApp: "whatsapp",
	sendMessageTelegram: "telegram",
	sendMessageDiscord: "discord",
	sendMessageSlack: "slack",
	sendMessageSignal: "signal",
	sendMessageIMessage: "imessage"
};
const CHANNEL_TO_LEGACY_DEP_KEY = {
	whatsapp: "sendWhatsApp",
	telegram: "sendTelegram",
	discord: "sendDiscord",
	slack: "sendSlack",
	signal: "sendSignal",
	imessage: "sendIMessage"
};
/**
* Pass CLI send sources through as-is — both CliOutboundSendSource and
* OutboundSendDeps are now channel-ID-keyed records.
*/
function createOutboundSendDepsFromCliSource(deps) {
	const outbound = { ...deps };
	for (const [legacySourceKey, channelId] of Object.entries(LEGACY_SOURCE_TO_CHANNEL)) {
		const sourceValue = deps[legacySourceKey];
		if (sourceValue !== void 0 && outbound[channelId] === void 0) outbound[channelId] = sourceValue;
	}
	for (const [channelId, legacyDepKey] of Object.entries(CHANNEL_TO_LEGACY_DEP_KEY)) {
		const sourceValue = outbound[channelId];
		if (sourceValue !== void 0 && outbound[legacyDepKey] === void 0) outbound[legacyDepKey] = sourceValue;
	}
	return outbound;
}
//#endregion
//#region src/cli/deps.ts
function createUnsupportedSender(channelId) {
	return async () => {
		throw new Error(`${channelId} send is unavailable in this trimmed build.`);
	};
}
function createDefaultDeps() {
	return {
		whatsapp: createUnsupportedSender("whatsapp"),
		telegram: createUnsupportedSender("telegram"),
		discord: createUnsupportedSender("discord"),
		slack: createUnsupportedSender("slack"),
		signal: createUnsupportedSender("signal"),
		imessage: createUnsupportedSender("imessage")
	};
}
function createOutboundSendDeps$1(deps) {
	return createOutboundSendDepsFromCliSource(deps);
}
//#endregion
//#region src/cli/outbound-send-deps.ts
function createOutboundSendDeps(deps) {
	return createOutboundSendDepsFromCliSource(deps);
}
//#endregion
export { createDefaultDeps as n, createOutboundSendDeps$1 as r, createOutboundSendDeps as t };
