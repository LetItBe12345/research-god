import { a as hasConfiguredSecretInput, l as normalizeSecretInputString } from "./types.secrets-BrzD-dBG.js";
//#region src/commands/onboard-search.ts
const SEARCH_PROVIDER_OPTIONS = [
	{
		value: "brave",
		label: "Brave Search",
		hint: "Structured results · country/language/time filters",
		envKeys: ["BRAVE_API_KEY"],
		placeholder: "BSA...",
		signupUrl: "https://brave.com/search/api/"
	},
	{
		value: "gemini",
		label: "Gemini (Google Search)",
		hint: "Google Search grounding · AI-synthesized",
		envKeys: ["GEMINI_API_KEY"],
		placeholder: "AIza...",
		signupUrl: "https://aistudio.google.com/apikey"
	},
	{
		value: "grok",
		label: "Grok (xAI)",
		hint: "xAI web-grounded responses",
		envKeys: ["XAI_API_KEY"],
		placeholder: "xai-...",
		signupUrl: "https://console.x.ai/"
	},
	{
		value: "kimi",
		label: "Kimi (Moonshot)",
		hint: "Moonshot web search",
		envKeys: ["KIMI_API_KEY", "MOONSHOT_API_KEY"],
		placeholder: "sk-...",
		signupUrl: "https://platform.moonshot.cn/"
	},
	{
		value: "perplexity",
		label: "Perplexity Search",
		hint: "Structured results · domain/country/language/time filters",
		envKeys: ["PERPLEXITY_API_KEY"],
		placeholder: "pplx-...",
		signupUrl: "https://www.perplexity.ai/settings/api"
	}
];
function hasKeyInEnv(entry) {
	return entry.envKeys.some((k) => Boolean(process.env[k]?.trim()));
}
function rawKeyValue(config, provider) {
	const search = config.tools?.web?.search;
	switch (provider) {
		case "brave": return search?.apiKey;
		case "gemini": return search?.gemini?.apiKey;
		case "grok": return search?.grok?.apiKey;
		case "kimi": return search?.kimi?.apiKey;
		case "perplexity": return search?.perplexity?.apiKey;
	}
}
/** Returns the plaintext key string, or undefined for SecretRefs/missing. */
function resolveExistingKey(config, provider) {
	return normalizeSecretInputString(rawKeyValue(config, provider));
}
/** Returns true if a key is configured (plaintext string or SecretRef). */
function hasExistingKey(config, provider) {
	return hasConfiguredSecretInput(rawKeyValue(config, provider));
}
function applySearchKey(config, provider, key) {
	const search = {
		...config.tools?.web?.search,
		provider,
		enabled: true
	};
	switch (provider) {
		case "brave":
			search.apiKey = key;
			break;
		case "gemini":
			search.gemini = {
				...search.gemini,
				apiKey: key
			};
			break;
		case "grok":
			search.grok = {
				...search.grok,
				apiKey: key
			};
			break;
		case "kimi":
			search.kimi = {
				...search.kimi,
				apiKey: key
			};
			break;
		case "perplexity":
			search.perplexity = {
				...search.perplexity,
				apiKey: key
			};
			break;
	}
	return {
		...config,
		tools: {
			...config.tools,
			web: {
				...config.tools?.web,
				search
			}
		}
	};
}
//#endregion
export { SEARCH_PROVIDER_OPTIONS, applySearchKey, hasExistingKey, hasKeyInEnv, resolveExistingKey };
