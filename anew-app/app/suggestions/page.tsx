"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SuggestionCard from "@/components/SuggestionCard";

type Suggestion = {
  type: "message" | "action";
  text: string;
  why: string;
};

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

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const situation = sessionStorage.getItem("situation") || "パートナーとの関係に悩んでいます。";

    fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleAction() {
    if (selected === null) return;
    const s = suggestions[selected];

    if (s.type === "message") {
      await navigator.clipboard.writeText(s.text).catch(() => {});
      setCopied(true);
      setTimeout(() => {
        router.push("/done");
      }, 800);
    } else {
      router.push("/done");
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen px-6 py-8"
      style={{ background: "var(--warm-white)" }}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <h1
          className="text-3xl font-light tracking-widest text-charcoal"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Anew
        </h1>
        <ProgressDots active={2} />
      </div>

      <h2
        className="text-2xl font-medium text-charcoal mb-1 leading-snug"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        今夜できる、
        <br />
        小さな一歩。
      </h2>
      <p className="text-sm text-stone mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        ひとつ選んで、試してみてください。
      </p>

      {/* Cards */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            提案を考えています...
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              selected={selected === i}
              onSelect={() => setSelected(i)}
            />
          ))}
        </div>
      )}

      {/* CTA */}
      {selected !== null && (
        <div className="mt-auto">
          <button
            onClick={handleAction}
            className="w-full py-4 rounded-2xl text-white font-medium text-base transition-opacity hover:opacity-90"
            style={{
              background: "var(--clay)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {copied
              ? "コピーしました ✓"
              : suggestions[selected]?.type === "message"
              ? "メッセージをコピーする"
              : "これを試してみる"}
          </button>
        </div>
      )}
    </div>
  );
}
