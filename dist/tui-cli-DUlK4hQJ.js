import "./paths-tuenh9TL.js";
import { f as defaultRuntime, k as theme } from "./subsystem-C5Ov5Tl6.js";
import "./utils-J_jJJlhx.js";
import "./reply-BJBzAldK.js";
import "./agent-scope-mSwAEzsR.js";
import "./openclaw-root-BWGgUZ_i.js";
import "./exec-DUrziqOt.js";
import "./github-copilot-token-BpS_ZjgB.js";
import "./boolean-BU9WMbx8.js";
import "./env-OR0Y-huw.js";
import "./env-overrides-37xHf7xH.js";
import "./skills-yYj6k7r6.js";
import "./frontmatter-SlsKMQGu.js";
import "./query-expansion-FbPYVnkg.js";
import "./redact-CAos4U4e.js";
import "./path-alias-guards-C8KQ9P9S.js";
import "./errors-DVPXQeA6.js";
import "./cmd-argv-C0hFDCCx.js";
import "./restart-stale-pids-BQ4ZYZtt.js";
import "./delivery-queue-D5j15BIP.js";
import "./paths-CCtAY9XW.js";
import "./session-cost-usage-CPJEuaoV.js";
import { t as formatDocsLink } from "./links-CQdKVoyv.js";
import "./cli-utils-DOT-XcGX.js";
import { t as parseTimeoutMs } from "./parse-timeout-BpHhl2yq.js";
import { t as runTui } from "./tui-V-tHgd7i.js";
//#region src/cli/tui-cli.ts
function registerTuiCli(program) {
	program.command("tui").description("Open a terminal UI connected to the Gateway").option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)").option("--token <token>", "Gateway token (if required)").option("--password <password>", "Gateway password (if required)").option("--session <key>", "Session key (default: \"main\", or \"global\" when scope is global)").option("--deliver", "Deliver assistant replies", false).option("--thinking <level>", "Thinking level override").option("--message <text>", "Send an initial message after connecting").option("--timeout-ms <ms>", "Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)").option("--history-limit <n>", "History entries to load", "200").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`).action(async (opts) => {
		try {
			const timeoutMs = parseTimeoutMs(opts.timeoutMs);
			if (opts.timeoutMs !== void 0 && timeoutMs === void 0) defaultRuntime.error(`warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`);
			const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
			await runTui({
				url: opts.url,
				token: opts.token,
				password: opts.password,
				session: opts.session,
				deliver: Boolean(opts.deliver),
				thinking: opts.thinking,
				message: opts.message,
				timeoutMs,
				historyLimit: Number.isNaN(historyLimit) ? void 0 : historyLimit
			});
		} catch (err) {
			defaultRuntime.error(String(err));
			defaultRuntime.exit(1);
		}
	});
}
//#endregion
export { registerTuiCli };
