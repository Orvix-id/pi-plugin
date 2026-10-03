import { expect, test } from "bun:test";
import { KNOWN_MODELS } from "../src/constants.ts";
import orvixCoding, { withSessionID } from "../src/index.ts";
import { fetchModelIDs, localID, thinkingLevelMap, toModelConfig } from "../src/models.ts";

test("withSessionID adds the session and respects an existing one", () => {
  expect(withSessionID({ model: "glm-5.2" }, "s1")).toEqual({ model: "glm-5.2", session_id: "s1" });
  expect(withSessionID({ session_id: "mine" }, "s1")).toBeUndefined();
  expect(withSessionID({ model: "x" }, undefined)).toBeUndefined();
  expect(withSessionID([1, 2], "s1")).toBeUndefined();
});

test("model config strips the prefix and maps thinking levels", () => {
  expect(localID("orvix/glm-5.2")).toBe("glm-5.2");
  const glm = toModelConfig("orvix/glm-5.2") as any;
  expect(glm.id).toBe("glm-5.2");
  expect(glm.reasoning).toBe(true);
  expect(glm.thinkingLevelMap.off).toBe("none");
  const ds = thinkingLevelMap(KNOWN_MODELS["deepseek-v4-pro"]!.efforts!);
  expect(ds.medium).toBeNull();
  expect(ds.high).toBe("high");
  const flash = toModelConfig("orvix/glm-5.3-flash") as any;
  expect(flash.reasoning).toBe(false);
  expect(flash.thinkingLevelMap).toBeUndefined();
});

test("fetchModelIDs reads the OpenAI list shape", async () => {
  const fake = (async () => Response.json({ data: [{ id: "orvix/glm-5.2" }, { id: 3 }] })) as unknown as typeof fetch;
  expect(await fetchModelIDs("https://x/coding/v1", "k", undefined, fake)).toEqual(["orvix/glm-5.2"]);
});

test("extension registers the provider and only touches its own requests", async () => {
  let provider: any;
  const handlers: Record<string, Function> = {};
  orvixCoding({
    registerProvider: (name: string, config: any) => (provider = { name, config }),
    on: (event: string, fn: Function) => (handlers[event] = fn),
  } as any);
  expect(provider.name).toBe("orvix-coding");
  expect(provider.config.api).toBe("openai-completions");
  expect(provider.config.models.length).toBe(Object.keys(KNOWN_MODELS).length);

  const hook = handlers.before_provider_request!;
  const ctx = (providerID: string) => ({ model: { provider: providerID }, sessionManager: { getSessionId: () => "s1" } });
  expect(hook({ payload: { a: 1 } }, ctx("orvix-coding"))).toEqual({ a: 1, session_id: "s1" });
  expect(hook({ payload: { a: 1 } }, ctx("openai"))).toBeUndefined();
});
