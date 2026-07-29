import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAllowedAiBaseUrl } from "@/core/ai/config";
import { requestEditPlan } from "@/core/ai/provider";

const plan = {
  schemaVersion: 1 as const,
  id: "plan-1",
  baseRevision: 3,
  title: "Add hook marker",
  explanation: "Marks the opening hook.",
  warnings: [],
  operations: [
    {
      op: "addMarker" as const,
      id: "marker-1",
      time: 0,
      label: "Hook",
      color: "#8c7ac4",
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI provider adapters", () => {
  it("forces and parses an OpenAI-compatible edit-plan tool call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "apply_edit_plan",
                      arguments: JSON.stringify(plan),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestEditPlan(
        {
          provider: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          model: "test-model",
          apiKey: "test-key",
          temperature: 0.1,
        },
        "system",
        "user",
      ),
    ).resolves.toEqual(plan);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as {
      tool_choice: { function: { name: string } };
    };
    expect(body.tool_choice.function.name).toBe("apply_edit_plan");
    expect(request.headers).toMatchObject({
      Authorization: "Bearer test-key",
    });
  });

  it("parses an Anthropic tool-use response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            content: [
              {
                type: "tool_use",
                name: "apply_edit_plan",
                input: plan,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      requestEditPlan(
        {
          provider: "anthropic",
          baseUrl: "https://api.anthropic.com",
          model: "test-model",
          apiKey: "test-key",
          temperature: 0,
        },
        "system",
        "user",
      ),
    ).resolves.toEqual(plan);
  });

  it("rejects unapproved origins and non-HTTPS URLs", () => {
    expect(() => assertAllowedAiBaseUrl("http://api.openai.com/v1")).toThrow(
      "must use HTTPS",
    );
    expect(() =>
      assertAllowedAiBaseUrl("https://metadata.internal.example/v1"),
    ).toThrow("not enabled");
  });
});
