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
export const PLUGIN_VERSION = "0.1.0";

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

/**
 * Coding lineup at release. `/coding/v1/models` stays authoritative for which
 * ids exist; these entries only supply output ceilings and reasoning profiles.
 */
export const KNOWN_MODELS: Record<string, KnownModel> = {
  "grok-4.7": { name: "Grok 4.7", output: 32_768, image: true },
  "qwen-3.8-max": { name: "Qwen 3.8 Max", output: 32_768, image: true },
  "minimax-m3": { name: "MiniMax M3", output: 32_768, image: false },
  "glm-5.2": {
    name: "GLM 5.2",
    output: 32_768,
    image: false,
    efforts: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
  },
  "deepseek-v4-pro": {
    name: "DeepSeek V4 Pro",
    output: 384_000,
    image: false,
    efforts: ["none", "low", "high", "max"],
  },
  "deepseek-v4-flash": { name: "DeepSeek V4 Flash", output: 384_000, image: false },
  "gpt-5.6-luna": {
    name: "GPT-5.6 Luna",
    output: 128_000,
    image: true,
    efforts: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  "mimo-v2.5-pro": { name: "MiMo V2.5 Pro", output: 128_000, image: false },
  "mimo-v2.5": { name: "MiMo V2.5", output: 128_000, image: true },
  "glm-5.3-flash": { name: "GLM 5.3 Flash", output: 131_072, image: false },
};
