import { NextResponse } from "next/server";
import { z } from "zod";
import { aiProviderConfigSchema } from "@/core/ai/config";
import { requestEditPlan } from "@/core/ai/provider";
import { consumeRateLimit } from "@/core/ai/rate-limit";
import { createEmptyProject } from "@/core/schema/project";
import { summarizeProject } from "@/core/editor/project-summary";
import { buildEditPlannerPrompt } from "@/core/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  config: aiProviderConfigSchema,
});

export async function POST(request: Request) {
  const key = request.headers.get("x-forwarded-for") ?? "local-test";
  if (!consumeRateLimit(`test:${key}`)) {
    return NextResponse.json({ error: "Too many tests." }, { status: 429 });
  }
  const startedAt = Date.now();
  try {
    const { config } = requestSchema.parse(await request.json());
    const project = createEmptyProject("connection-test", 1);
    const plan = await requestEditPlan(
      config,
      buildEditPlannerPrompt(summarizeProject(project)),
      "Add a marker at time 0 named Connection test.",
    );
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      model: config.model,
      operation: plan.operations[0]?.op,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Connection test failed.",
      },
      { status: 400 },
    );
  }
}
