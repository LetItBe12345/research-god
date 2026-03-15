//#region src/line/accounts.ts
function listLineAccountIds() {
	return [];
}
function resolveDefaultLineAccountId() {}
function resolveLineAccount() {
	throw new Error("LINE is unavailable in this trimmed build.");
}
function normalizeAccountId(accountId) {
	return accountId?.trim() || "default";
}
//#endregion
export { listLineAccountIds, normalizeAccountId, resolveDefaultLineAccountId, resolveLineAccount };
