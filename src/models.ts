import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { DEFAULT_CONTEXT, DEFAULT_OUTPUT, type Effort, KNOWN_MODELS, MODEL_PREFIX } from "./constants.ts";

/** Pi thinking levels, mapped onto Orvix `reasoning_effort`. */
const PI_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

/** `orvix/glm-5.2` -> `glm-5.2`, so users pick `orvix-coding/glm-5.2`. */
export function localID(upstreamID: string): string {
  return upstreamID.startsWith(MODEL_PREFIX) ? upstreamID.slice(MODEL_PREFIX.length) : upstreamID;
}

/** Unsupported levels map to `null` so Pi clamps instead of sending a value the upstream rejects. */
export function thinkingLevelMap(efforts: readonly Effort[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const level of PI_LEVELS) {
    const effort = level === "off" ? "none" : level;
    map[level] = efforts.includes(effort) ? effort : null;
  }
  return map;
}

export function toModelConfig(upstreamID: string): ProviderModelConfig {
  const id = localID(upstreamID);
  const known = KNOWN_MODELS[id];
  const efforts = known?.efforts ?? [];
  const reasoning = efforts.length > 0;
  return {
    id,
    name: known?.name ?? id,
    reasoning,
    ...(reasoning ? { thinkingLevelMap: thinkingLevelMap(efforts) } : {}),
    input: known?.image ? ["text", "image"] : ["text"],
    // Orvix bills the Coding Plan against plan quota, not per token.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT,
    maxTokens: known?.output ?? DEFAULT_OUTPUT,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: reasoning,
      supportsUsageInStreaming: true,
    },
  } as ProviderModelConfig;
}

export const FALLBACK_MODELS: ProviderModelConfig[] = Object.keys(KNOWN_MODELS).map(toModelConfig);

/** Ids from `GET {baseUrl}/models`, the Coding allowlist (not the `/v1` catalogue). */
export async function fetchModelIDs(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: signal ?? AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GET /models returned ${res.status}`);
  const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
