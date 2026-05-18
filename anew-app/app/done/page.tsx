"use client";

import { useRouter } from "next/navigation";

export default function DonePage() {
  const router = useRouter();

  function restart() {
    sessionStorage.removeItem("situation");
    router.push("/");
  }

  return (
    <div
      className="flex flex-col min-h-screen px-6 items-center justify-center text-center"
      style={{ background: "var(--warm-white)" }}
    >
      <h1
        className="text-4xl font-light text-charcoal mb-4 leading-snug"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        一歩、
        <br />
        踏み出せました。
      </h1>
      <p
        className="text-sm text-stone mb-12 leading-relaxed"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        小さな行動が、関係を少しずつ変えていきます。
        <br />
        焦らず、自分のペースで。
      </p>

      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-12"
        style={{ background: "var(--section-alt)" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8704E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <button
        onClick={restart}
        className="text-sm text-stone underline underline-offset-4"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        最初からやり直す
      </button>
    </div>
  );
}
