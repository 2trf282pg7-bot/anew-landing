import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { messages, turnCount } = (await req.json()) as {
    messages: Message[];
    turnCount: number;
  };

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  });

  const reply =
    response.content[0].type === "text" ? response.content[0].text : "";
  const done = turnCount >= 3;

  return NextResponse.json({ reply, done });
}
