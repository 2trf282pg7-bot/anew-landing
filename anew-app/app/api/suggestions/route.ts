import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SUGGESTIONS_SYSTEM_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { situation } = (await req.json()) as { situation: string };

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SUGGESTIONS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: situation }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] };

  return NextResponse.json(parsed);
}
