import { describe, expect, it } from "vitest";
import "./test-helpers/fast-core-tools.js";
import { createOpenClawTools } from "./openclaw-tools.js";

describe("createOpenClawTools tool removal", () => {
  it("does not register agents_list by default", () => {
    const names = new Set(
      createOpenClawTools({
        agentSessionKey: "main",
      }).map((tool) => tool.name),
    );
    expect(names.has("agents_list")).toBe(false);
  });
});
