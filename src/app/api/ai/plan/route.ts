import { NextResponse } from "next/server";
import { z } from "zod";
import { aiProviderConfigSchema } from "@/core/ai/config";
import { buildEditPlannerPrompt } from "@/core/ai/prompts";
import { requestEditPlan } from "@/core/ai/provider";
import { consumeRateLimit } from "@/core/ai/rate-limit";
import { projectSchema } from "@/core/schema/project";
import { summarizeProject } from "@/core/editor/project-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  request: z.string().trim().min(1).max(4_000),
  project: projectSchema,
  context: z.object({
    currentTime: z.number().finite().nonnegative(),
    selectedClipIds: z.array(z.string().min(1)).max(100),
  }),
  config: aiProviderConfigSchema,
});

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  }
  if (!consumeRateLimit(clientKey(request))) {
    return NextResponse.json(
      { error: "Too many planning requests. Try again in a minute." },
      { status: 429 },
    );
  }

  try {
    const input = requestSchema.parse(await request.json());
    const plan = await requestEditPlan(
      input.config,
      buildEditPlannerPrompt(summarizeProject(input.project, input.context)),
      input.request,
    );
    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "The AI request or returned edit plan did not match the schema.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI planning failed.",
      },
      { status: 502 },
    );
  }
}
