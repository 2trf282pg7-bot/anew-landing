"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatBubble from "@/components/ChatBubble";
import QuickReplies from "@/components/QuickReplies";

type Message = { role: "user" | "assistant"; content: string };

const INITIAL_MESSAGE =
  "最近、パートナーとの間でどんなことが起きていますか？ゆっくりで大丈夫です。ここでは評価しません。";

function ProgressDots({ active }: { active: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i === active ? "bg-clay" : "bg-blush-deep"
          }`}
        />
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-stone typing-dot inline-block"
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setShowQuickReplies(false);
    setLoading(true);

    const nextTurn = turnCount + 1;

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        turnCount: nextTurn,
      }),
    });

    const data = await res.json();
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.reply },
    ]);
    setTurnCount(nextTurn);
    setLoading(false);

    if (data.done) {
      const situation = newMessages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" / ");
      sessionStorage.setItem("situation", situation);
      setTimeout(() => router.push("/paywall"), 1200);
    }
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--warm-white)" }}>
      {/* Header */}
      <div className="flex flex-col items-center pt-8 pb-4 px-6 gap-3">
        <h1
          className="text-3xl font-light tracking-widest text-charcoal"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Anew
        </h1>
        <ProgressDots active={0} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && <TypingIndicator />}
        {showQuickReplies && !loading && (
          <QuickReplies onSelect={sendMessage} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-blush-deep bg-warm-white">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="ここに気持ちを話してください..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-blush-deep bg-white px-4 py-3 text-sm text-charcoal placeholder-stone focus:outline-none focus:border-clay transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-clay text-white flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21L23 12 2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
