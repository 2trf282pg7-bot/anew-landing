"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

type PatternInfo = { label: string; desc: string };

function detectPattern(situation: string): PatternInfo {
  if (/誘|スキンシップ|求め/.test(situation)) {
    return {
      label: "欲求のすれ違いサイクル",
      desc: "一方が求め、もう一方が引く——このループがあなたたちを疲弊させています。",
    };
  }
  if (/喧嘩|言い合い|同じ/.test(situation)) {
    return {
      label: "グリッドロック（固着）パターン",
      desc: "同じ議論が繰り返されるとき、それは価値観の対立が根底にあるサインです。",
    };
  }
  if (/話せ|言えない|黙/.test(situation)) {
    return {
      label: "沈黙の壁パターン",
      desc: "言葉が届かないとき、関係は静かに距離を広げていきます。",
    };
  }
  return {
    label: "追いかけ・引きこもりのサイクル",
    desc: "一方が近づこうとするほど、もう一方が遠ざかる——よく見られるダイナミクスです。",
  };
}

function PatternCard({
  pattern,
  blurred,
}: {
  pattern: PatternInfo;
  blurred?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-5 bg-white shadow-sm border border-blush-deep ${
        blurred ? "overflow-hidden" : ""
      }`}
    >
      {blurred && (
        <div className="absolute inset-0 backdrop-blur-sm bg-white/60 rounded-2xl z-10" />
      )}
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-clay mt-2 shrink-0" />
        <div>
          <p
            className="font-medium text-charcoal mb-1"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem" }}
          >
            {pattern.label}
          </p>
          <p className="text-sm text-charcoal-soft leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {pattern.desc}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaywallPage() {
  const [pattern, setPattern] = useState<PatternInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    const situation = sessionStorage.getItem("situation") || "";
    setPattern(detectPattern(situation));
  }, []);

  const DUMMY_PATTERN: PatternInfo = {
    label: "感情的な孤立パターン",
    desc: "もう一つの関係パターンが隠れています。",
  };

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
        <ProgressDots active={1} />
      </div>

      {/* Headline */}
      <h2
        className="text-2xl font-medium text-charcoal mb-2 leading-snug"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        なぜ辛かったのか、
        <br />
        わかってきた。
      </h2>
      <p className="text-sm text-stone mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        あなたの話から、2つのパターンが見えています。
      </p>

      {/* Pattern Cards */}
      <div className="flex flex-col gap-3 mb-8">
        {pattern && <PatternCard pattern={pattern} />}
        <PatternCard pattern={DUMMY_PATTERN} blurred />
      </div>

      {/* CTA */}
      <div className="mt-auto">
        <button
          onClick={() => router.push("/suggestions")}
          className="w-full py-4 rounded-2xl text-white font-medium text-base transition-opacity hover:opacity-90"
          style={{
            background: "var(--clay)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          今夜の一歩を見る
        </button>
        <p
          className="text-center text-xs text-stone mt-3"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          ベータ期間中は無料 · 早期メンバーは価格を永続維持
        </p>
      </div>
    </div>
  );
}
