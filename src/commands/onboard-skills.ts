import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

export async function setupSkills(
  cfg: OpenClawConfig,
  _workspaceDir: string,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note("Skills 已在此精简版本中停用。", "Skills");
  runtime.log("Skipping bundled skills setup.");
  return {
    ...cfg,
    skills: {
      ...cfg.skills,
      allowBundled: ["__none__"],
    },
  };
}
