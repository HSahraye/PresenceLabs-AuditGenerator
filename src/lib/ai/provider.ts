import { GoogleGenAI } from "@google/genai";
import { incrementUsageMetric } from "@/lib/billing/usage";
import { prisma } from "@/lib/prisma";

type StructuredPromptInput = {
  task: string;
  input: Record<string, unknown>;
  outputContract: string;
  metadata?: {
    workspaceId?: string;
    generationType?: string;
  };
};

function buildPrompt(input: StructuredPromptInput) {
  return [
    `Task: ${input.task}`,
    "You are an assistant that must return valid JSON only.",
    `Output contract: ${input.outputContract}`,
    `Input JSON: ${JSON.stringify(input.input)}`,
  ].join("\n\n");
}

function parseModelJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonCandidate = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
  return JSON.parse(jsonCandidate) as T;
}

const responseCache = new Map<string, string>();

export async function generateStructuredResponse<T>(input: StructuredPromptInput): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const cacheKey = `${model}:${input.task}:${JSON.stringify(input.input).slice(0, 2500)}`;
  if (responseCache.has(cacheKey)) {
    if (input.metadata?.workspaceId) {
      await prisma.aiUsageLog.create({
        data: {
          workspaceId: input.metadata.workspaceId,
          provider: "gemini",
          model,
          generationType: input.metadata.generationType || "structured",
          cacheHit: true,
          success: true,
          metadataJson: JSON.stringify({ task: input.task }),
        },
      });
    }
    return parseModelJson<T>(responseCache.get(cacheKey)!);
  }
  const start = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(input),
    });
    const text = response.text?.trim() ?? "";
    if (!text) return null;
    responseCache.set(cacheKey, text);
    const workspaceId = input.metadata?.workspaceId;
    const generationType = input.metadata?.generationType || "structured";
    const estimatedTokensIn = Math.max(1, Math.ceil(buildPrompt(input).length / 4));
    const estimatedTokensOut = Math.max(1, Math.ceil(text.length / 4));
    if (workspaceId) {
      await incrementUsageMetric({
        workspaceId,
        metric: "ai_generations",
        amount: 1,
        metadata: { provider: "gemini", generationType },
      });
    }
    await prisma.aiUsageLog.create({
      data: {
        workspaceId: workspaceId ?? null,
        provider: "gemini",
        model,
        generationType,
        estimatedTokensIn,
        estimatedTokensOut,
        latencyMs: Date.now() - start,
        cacheHit: false,
        success: true,
        metadataJson: JSON.stringify({ task: input.task }),
      },
    });
    return parseModelJson<T>(text);
  } catch (error) {
    await prisma.aiUsageLog.create({
      data: {
        workspaceId: input.metadata?.workspaceId ?? null,
        provider: "gemini",
        model,
        generationType: input.metadata?.generationType || "structured",
        latencyMs: Date.now() - start,
        cacheHit: false,
        success: false,
        metadataJson: JSON.stringify({ task: input.task, error: error instanceof Error ? error.message : "unknown" }),
      },
    });
    throw error;
  }
}

export async function generateNarrative<T>(input: StructuredPromptInput): Promise<T | null> {
  return generateStructuredResponse<T>(input);
}
