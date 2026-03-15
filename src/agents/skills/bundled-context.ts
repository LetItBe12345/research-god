import { loadSkillsFromDir } from "@mariozechner/pi-coding-agent";
import { resolveBundledSkillsDir, type BundledSkillsResolveOptions } from "./bundled-dir.js";

let cachedBundledContext: { dir: string; names: Set<string> } | null = null;

export type BundledSkillsContext = {
  dir?: string;
  names: Set<string>;
};

export function resolveBundledSkillsContext(
  opts: BundledSkillsResolveOptions = {},
): BundledSkillsContext {
  const dir = resolveBundledSkillsDir(opts);
  const names = new Set<string>();
  if (!dir) {
    return { dir, names };
  }

  if (cachedBundledContext?.dir === dir) {
    return { dir, names: new Set(cachedBundledContext.names) };
  }
  const result = loadSkillsFromDir({ dir, source: "openclaw-bundled" });
  for (const skill of result.skills) {
    if (skill.name.trim()) {
      names.add(skill.name);
    }
  }
  cachedBundledContext = { dir, names: new Set(names) };
  return { dir, names };
}
