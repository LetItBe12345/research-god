import { t as __exportAll } from "./rolldown-runtime-DUslC3ob.js";
import { Cp as createConfigIO } from "./auth-profiles-DZ4zIQH4.js";
import { a as displayPath } from "./utils-D0Yqqtk-.js";
//#region src/config/logging.ts
var logging_exports = /* @__PURE__ */ __exportAll({
	formatConfigPath: () => formatConfigPath,
	logConfigUpdated: () => logConfigUpdated
});
function formatConfigPath(path = createConfigIO().configPath) {
	return displayPath(path);
}
function logConfigUpdated(runtime, opts = {}) {
	const path = formatConfigPath(opts.path ?? createConfigIO().configPath);
	const suffix = opts.suffix ? ` ${opts.suffix}` : "";
	runtime.log(`Updated ${path}${suffix}`);
}
//#endregion
export { logConfigUpdated as n, logging_exports as r, formatConfigPath as t };
