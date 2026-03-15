import { r as normalizeStringEntries } from "./string-normalization-ChiSBXh2.js";
import { r as readChannelAllowFromStore } from "./pairing-store-CkFJMwFX.js";
//#region src/security/dm-policy-shared.ts
async function readStoreAllowFromForDmPolicy(params) {
	if (params.shouldRead === false || params.dmPolicy === "allowlist") return [];
	return await (params.readStore ?? ((provider, accountId) => readChannelAllowFromStore(provider, process.env, accountId)))(params.provider, params.accountId).catch(() => []);
}
async function resolveDmAllowState(params) {
	const configAllowFrom = normalizeStringEntries(Array.isArray(params.allowFrom) ? params.allowFrom : void 0);
	const hasWildcard = configAllowFrom.includes("*");
	const storeAllowFrom = await readStoreAllowFromForDmPolicy({
		provider: params.provider,
		accountId: params.accountId,
		readStore: params.readStore
	});
	const normalizeEntry = params.normalizeEntry ?? ((value) => value);
	const normalizedCfg = configAllowFrom.filter((value) => value !== "*").map((value) => normalizeEntry(value)).map((value) => value.trim()).filter(Boolean);
	const normalizedStore = storeAllowFrom.map((value) => normalizeEntry(value)).map((value) => value.trim()).filter(Boolean);
	const allowCount = Array.from(new Set([...normalizedCfg, ...normalizedStore])).length;
	return {
		configAllowFrom,
		hasWildcard,
		allowCount,
		isMultiUserDm: hasWildcard || allowCount > 1
	};
}
//#endregion
export { resolveDmAllowState as t };
