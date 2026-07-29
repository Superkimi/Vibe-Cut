import { z } from "zod";
import { editPlanSchema, type EditPlan } from "@/core/schema/edit-plan";
import type { AiProviderConfig } from "./config";
import { assertAllowedAiBaseUrl } from "./config";

const TOOL_NAME = "apply_edit_plan";
const REQUEST_TIMEOUT_MS = 45_000;

function planJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(editPlanSchema, {
    target: "draft-7",
    unrepresentable: "any",
  }) as Record<string, unknown>;
}

function joinUrl(baseUrl: URL, suffix: string): string {
  const base = baseUrl.toString().replace(/\/+$/, "");
  return `${base}${suffix}`;
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`AI provider returned non-JSON data (${response.status}).`);
    }
    if (!response.ok) {
      const record =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>)
          : {};
      const nested =
        typeof record.error === "object" && record.error !== null
          ? (record.error as Record<string, unknown>)
          : {};
      const message =
        typeof nested.message === "string"
          ? nested.message
          : `AI provider request failed (${response.status}).`;
      throw new Error(message);
    }
    return payload as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function parseToolArguments(value: unknown): EditPlan {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new Error("AI returned invalid JSON tool arguments.");
    }
  }
  return editPlanSchema.parse(candidate);
}

async function requestOpenAiCompatible(
  config: AiProviderConfig,
  system: string,
  user: string,
): Promise<EditPlan> {
  const baseUrl = assertAllowedAiBaseUrl(config.baseUrl);
  const payload = await fetchJson(joinUrl(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description:
              "Create one atomic, reversible Vibe Cut timeline edit plan.",
            parameters: planJsonSchema(),
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: TOOL_NAME },
      },
    }),
  });

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = choices[0] as Record<string, unknown> | undefined;
  const message =
    choice && typeof choice.message === "object" && choice.message !== null
      ? (choice.message as Record<string, unknown>)
      : undefined;
  const toolCalls =
    message && Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const toolCall = toolCalls[0] as Record<string, unknown> | undefined;
  const fn =
    toolCall && typeof toolCall.function === "object" && toolCall.function !== null
      ? (toolCall.function as Record<string, unknown>)
      : undefined;
  if (!fn || fn.name !== TOOL_NAME) {
    throw new Error("AI did not return an edit-plan tool call.");
  }
  return parseToolArguments(fn.arguments);
}

async function requestAnthropic(
  config: AiProviderConfig,
  system: string,
  user: string,
): Promise<EditPlan> {
  const baseUrl = assertAllowedAiBaseUrl(config.baseUrl);
  const payload = await fetchJson(joinUrl(baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4_096,
      temperature: config.temperature,
      system,
      messages: [{ role: "user", content: user }],
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Create one atomic, reversible Vibe Cut timeline edit plan.",
          input_schema: planJsonSchema(),
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  const content = Array.isArray(payload.content) ? payload.content : [];
  const toolUse = content.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as Record<string, unknown>).type === "tool_use" &&
      (item as Record<string, unknown>).name === TOOL_NAME,
  ) as Record<string, unknown> | undefined;
  if (!toolUse) {
    throw new Error("AI did not return an edit-plan tool call.");
  }
  return parseToolArguments(toolUse.input);
}

export async function requestEditPlan(
  config: AiProviderConfig,
  system: string,
  user: string,
): Promise<EditPlan> {
  if (config.provider === "anthropic") {
    return requestAnthropic(config, system, user);
  }
  return requestOpenAiCompatible(config, system, user);
}
