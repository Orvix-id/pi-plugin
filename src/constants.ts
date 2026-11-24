/** Provider id in Pi. Separate from any `/v1` Orvix provider. */
export const PROVIDER_ID = "orvix-coding";
export const PROVIDER_NAME = "Orvix Coding";

/**
 * OpenAI-compatible Coding Plan alias. Pi appends `/chat/completions`, which
 * lands on `POST /coding/v1/chat/completions` (scope `coding:invoke`).
 * `ORVIX_CODING_BASE_URL` overrides it for local probes.
 */
export const DEFAULT_BASE_URL = "https://api.orvix.id/coding/v1";
export const BASE_URL_ENV = "ORVIX_CODING_BASE_URL";
export const API_KEY_ENV = "ORVIX_CODING_API_KEY";

/** Observability-only headers. Orvix records the client name and version and uses them for nothing else. */
export const CLIENT_HEADER = "x-orvix-coding-client";
export const CLIENT_VERSION_HEADER = "x-orvix-coding-client-version";
export const CLIENT_NAME = "pi";
export const PLUGIN_VERSION = "0.1.1";

/** `/coding/v1/models` ids carry this prefix; the API adds it back when absent. */
export const MODEL_PREFIX = "orvix/";

export type Effort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface KnownModel {
  name: string;
  output: number;
  image: boolean;
  efforts?: readonly Effort[];
}

/**
 * Context window used for every model until `/coding/v1/models` reports one.
 * Too high and requests fail upstream; too low and Pi compacts early,
 * which also throws the prompt cache away.
 */
export const DEFAULT_CONTEXT = 200_000;
export const DEFAULT_OUTPUT = 32_768;

// Reasoning profiles verified against the live API (last verified
// 2026-11-09). Orvix forwards `reasoning_effort` upstream, so a value the
// upstream rejects surfaces as a 502: only list efforts a model accepts.
const FULL: readonly Effort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const MUSE: readonly Effort[] = ["minimal", "low", "medium", "high", "xhigh"];
const LUNA: readonly Effort[] = ["none", "low", "medium", "high", "xhigh", "max"];
const LADDER4: readonly Effort[] = ["none", "low", "high", "max"];
const LADDER3: readonly Effort[] = ["none", "low", "high"];

/**
 * Coding lineup, synced with the managed catalogue on 2026-11-24.
 * `/coding/v1/models` stays authoritative for which ids exist; these entries
 * supply output ceilings, image input and reasoning profiles, and the
 * offline fallback list.
 */
export const KNOWN_MODELS: Record<string, KnownModel> = {
  "deepseek-v4.1-flash": { name: "DeepSeek V4.1 Flash", output: 131_072, image: true, efforts: LADDER4 },
  "deepseek-v4-flash": { name: "DeepSeek V4 Flash", output: 384_000, image: false },
  "deepseek-v4-pro": { name: "DeepSeek V4 Pro", output: 384_000, image: false, efforts: LADDER4 },
  "glm-5.2": { name: "GLM 5.2", output: 32_768, image: false, efforts: FULL },
  "glm-5.3-flash": { name: "GLM 5.3 Flash", output: 131_072, image: true, efforts: LADDER4 },
  "gpt-5.6-luna": { name: "GPT-5.6 Luna", output: 128_000, image: true, efforts: LUNA },
  "gpt-5.6-sol": { name: "GPT-5.6 Sol", output: 128_000, image: true, efforts: FULL },
  "gpt-5.6-terra": { name: "GPT-5.6 Terra", output: 128_000, image: true, efforts: FULL },
  "gpt-6-luna": { name: "GPT-6 Luna", output: 128_000, image: true },
  "gpt-6-sol": { name: "GPT-6 Sol", output: 128_000, image: true },
  hy3: { name: "Hy3", output: 32_768, image: false },
  "mimo-v2.6-pro": { name: "MiMo V2.6 Pro", output: 128_000, image: false, efforts: LADDER3 },
  "minimax-m3": { name: "MiniMax M3", output: 32_768, image: false },
  "muse-spark-1.3": { name: "Muse Spark 1.3", output: 80_000, image: true, efforts: MUSE },
  "qwen-3.8-flash": { name: "Qwen 3.8 Flash", output: 65_536, image: false },
  "qwen-3.8-max": { name: "Qwen 3.8 Max", output: 32_768, image: true },
};
