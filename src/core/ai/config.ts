import { z } from "zod";

export const aiProviderConfigSchema = z.object({
  provider: z.enum(["openai-compatible", "anthropic"]),
  model: z.string().trim().min(1).max(200),
  baseUrl: z.string().url().max(500),
  apiKey: z.string().trim().min(1).max(2_000),
  temperature: z.number().min(0).max(1).default(0.1),
});

export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>;

export const DEFAULT_PROVIDER_CONFIG = {
  provider: "openai-compatible" as const,
  model: "gpt-5-mini",
  baseUrl: "https://api.openai.com/v1",
  temperature: 0.1,
};

const BUILT_IN_ALLOWED_ORIGINS = new Set([
  "https://api.openai.com",
  "https://api.anthropic.com",
  "https://openrouter.ai",
  "https://api.deepseek.com",
  "https://api.groq.com",
  "https://api.moonshot.cn",
  "https://dashscope.aliyuncs.com",
]);

export function assertAllowedAiBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") {
    throw new Error("AI base URL must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("AI base URL cannot contain credentials.");
  }

  const configured = (process.env.VIBECUT_AI_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...BUILT_IN_ALLOWED_ORIGINS, ...configured]);
  if (!allowedOrigins.has(url.origin)) {
    throw new Error(
      "This AI origin is not enabled by the server. Add it to VIBECUT_AI_ALLOWED_ORIGINS.",
    );
  }
  return url;
}
