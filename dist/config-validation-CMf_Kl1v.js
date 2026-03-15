import { am as readConfigFileSnapshot } from "./reply-BJBzAldK.js";
import { t as formatCliCommand } from "./command-format-CEAcyghQ.js";
import { n as formatConfigIssueLines } from "./issue-format-C8GUIW_E.js";
//#region src/commands/config-validation.ts
async function requireValidConfigSnapshot(runtime) {
	const snapshot = await readConfigFileSnapshot();
	if (snapshot.exists && !snapshot.valid) {
		const issues = snapshot.issues.length > 0 ? formatConfigIssueLines(snapshot.issues, "-").join("\n") : "Unknown validation issue.";
		runtime.error(`Config invalid:\n${issues}`);
		runtime.error(`Fix the config or run ${formatCliCommand("openclaw doctor")}.`);
		runtime.exit(1);
		return null;
	}
	return snapshot.config;
}
//#endregion
export { requireValidConfigSnapshot as t };
