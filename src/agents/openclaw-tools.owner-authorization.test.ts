import { describe, expect, it } from "vitest";
import "./test-helpers/fast-core-tools.js";
import { createOpenClawTools } from "./openclaw-tools.js";

function readToolByName() {
  return new Map(createOpenClawTools().map((tool) => [tool.name, tool]));
}

describe("createOpenClawTools owner authorization", () => {
  it("marks owner-only core tools in raw registration", () => {
    const tools = readToolByName();
    expect(tools.get("cron")?.ownerOnly).toBe(true);
  });

  it("does not register removed non-secretary tools", () => {
    const tools = readToolByName();
    expect(tools.has("canvas")).toBe(false);
    expect(tools.has("gateway")).toBe(false);
    expect(tools.has("nodes")).toBe(false);
  });
});
