"use client";

import { useState, useRef, useEffect } from "react";

type Phase = "idle" | "chat" | "confirm" | "paywall" | "suggestions" | "done";
type Message = { role: "user" | "assistant"; content: string };
type Suggestion = { type: "message" | "action"; text: string; why: string };
type PatternInfo = { label: string; desc: string; tag: string };

const INITIAL_MSG = "最近、パートナーとの間でどんなことが起きていますか？ゆっくりで大丈夫です。ここでは評価しません。";

const PATTERNS: { regex: RegExp; info: PatternInfo }[] = [
  { regex: /誘|スキンシップ|求め|initiati/, info: { label: "欲求のすれ違いサイクル", desc: "一方が求め、もう一方が引く——このループがふたりを疲弊させています。どちらも悪くない、ただパターンがある。", tag: "Pursuer-Withdrawer Cycle" } },
  { regex: /喧嘩|言い合い|同じ|fight/, info: { label: "グリッドロック（固着）パターン", desc: "同じ議論が繰り返されるとき、それは価値観の対立が根底にあるサインです。", tag: "Gridlock Pattern" } },
  { regex: /話せ|言えない|黙|silent/, info: { label: "沈黙の壁パターン", desc: "言葉が届かないとき、関係は静かに距離を広げていきます。でも壁は取り除けます。", tag: "Stonewalling Pattern" } },
];
const DEFAULT_PATTERN: PatternInfo = { label: "追いかけ・引きこもりのサイクル", desc: "一方が近づくほどもう一方が遠ざかる——よくあるダイナミクスです。誰のせいでもありません。", tag: "Demand-Withdraw Cycle" };

function detectPattern(situation: string): PatternInfo {
  for (const p of PATTERNS) {
    if (p.regex.test(situation)) return p.info;
  }
  return DEFAULT_PATTERN;
}

const demoData = [
  { msg: "「最近、ふたりの時間が減ってる気がして、少し寂しかった。今週末、一緒に出かけない？」", why: "低プレッシャーのつながりの誘いは、直接的な対立より効果的です（Gottman研究）" },
  { msg: "「あなたに求めたいと感じているとき、どうすればいいか迷ってる。もっと正直に話してもいい？」", why: "「非難」ではなく「願い」として伝えることで、防御的な反応を防ぎます" },
  { msg: "「同じことが繰り返されるのは、お互いが大切に思っているからだと思う。少し違う話し方、試してみない？」", why: "「あなた対私」から「私たち対問題」に視点を変えます（ゴットマン理論）" },
  { msg: "「ずっと話したいことがあって、どう切り出せばいいかわからなかった。少し聞いてくれる？」", why: "許可を求めることで相手の不安が下がり、聞いてもらえる可能性が上がります" },
];

const faqData = [
  { q: "パートナーも使う必要がありますか？", a: "必要ありません。Anewはひとりで始めるために作られています。多くのユーザーはひとりで始め、やがてパートナーにメッセージを送ります。" },
  { q: "これはセラピーの代わりになりますか？", a: "なりません。Anewはセラピーを受けるまでの空白期間のためのツールです。深刻な問題がある場合は専門家にご相談ください。" },
  { q: "会話は誰かに見られますか？", a: "誰も見ません。匿名でご利用いただけます。メールアドレスは会話に紐付けられません。" },
  { q: "料金はかかりますか？", a: "ベータ期間中は無料です。リリース後は月額1,980〜2,480円の予定。早期メンバーは永続的に初期価格を維持できます。" },
];

const QUICK_REPLIES = ["最近、距離を感じる", "向こうから誘ってこない", "同じことで何度も喧嘩する", "もう話せなくなった"];

function TypingDots() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
        {[0, 1, 2].map((i) => <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-stone inline-block" />)}
      </div>
    </div>
  );
}

function Dot({ active, idx }: { active: number; idx: number }) {
  return <div className={`w-1.5 h-1.5 rounded-full ${idx === active ? "bg-clay" : "bg-blush-deep"}`} />;
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: INITIAL_MSG }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [showQuick, setShowQuick] = useState(true);
  const [situation, setSituation] = useState("");
  const [pattern, setPattern] = useState<PatternInfo | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [nextCheckIn, setNextCheckIn] = useState<string | null>(null);
  const [demoIdx, setDemoIdx] = useState<number | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lp-visible"); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll(".lp-reveal, .lp-stat").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const cards = cardsRef.current?.querySelectorAll<HTMLElement>(".hcard");
    if (!cards) return;
    const rots = [-3, 0.5, 2.5];
    const handler = (e: MouseEvent) => {
      const dx = (e.clientX - window.innerWidth / 2) / window.innerWidth;
      const dy = (e.clientY - window.innerHeight / 2) / window.innerHeight;
      cards.forEach((c, i) => {
        const d = (i + 1) * 7;
        c.style.transform = i === 1
          ? `translateX(calc(-50% + ${dx * d}px)) translateY(${dy * d}px) rotate(${rots[i]}deg)`
          : `translateX(${dx * d}px) translateY(${dy * d}px) rotate(${rots[i]}deg)`;
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (phase === "suggestions" && suggestions.length === 0) {
      setSugLoading(true);
      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation }),
      })
        .then((r) => r.json())
        .then((d) => { setSuggestions(d.suggestions || []); setSugLoading(false); })
        .catch(() => setSugLoading(false));
    }
  }, [phase]);

  function openApp() {
    setPhase("chat");
    setMessages([{ role: "assistant", content: INITIAL_MSG }]);
    setInput("");
    setTurnCount(0);
    setShowQuick(true);
    setSelected(null);
    setCopied(false);
    setNextCheckIn(null);
    setSuggestions([]);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setShowQuick(false);
    setLoading(true);
    const nextTurn = turnCount + 1;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next, turnCount: nextTurn }),
    });
    const data = await res.json();
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    setTurnCount(nextTurn);
    setLoading(false);
    if (data.done) {
      setTimeout(() => setPhase("confirm"), 800);
    }
  }

  function handleConfirm() {
    const sit = messages.filter((m) => m.role === "user").map((m) => m.content).join(" / ");
    setSituation(sit);
    setPattern(detectPattern(sit));
    setPhase("paywall");
  }

  async function handleSuggestionAction() {
    if (selected === null) return;
    const s = suggestions[selected];
    if (s.type === "message") {
      await navigator.clipboard.writeText(s.text).catch(() => {});
      setCopied(true);
      setTimeout(() => setPhase("done"), 700);
    } else {
      setPhase("done");
    }
  }

  const overlayPhases: Phase[] = ["chat", "confirm", "paywall", "suggestions", "done"];
  const showOverlay = overlayPhases.includes(phase);

  const phaseProgress: Record<Phase, number> = { idle: 0, chat: 0, confirm: 0, paywall: 1, suggestions: 2, done: 2 };

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--cream:#F2EDE6;--clay:#B8704E;--clay-light:#D4906E;--clay-dark:#8C4E32;--charcoal:#1C1614;--charcoal-mid:#3A2E28;--charcoal-soft:#5C4D45;--stone:#8A7870;--blush:#EDD4C6;--blush-deep:#DBBAA6;--section-alt:#F5EFE8;--warm-white:#FAF6F1}
        body{background:var(--warm-white);color:var(--charcoal);font-family:'DM Sans',sans-serif;font-weight:300;overflow-x:hidden}
        .lp-nav{position:fixed;top:0;left:0;right:0;z-index:200;padding:26px 48px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(to bottom,rgba(250,246,241,.97) 0%,rgba(250,246,241,0) 100%)}
        .lp-logo{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:400;color:var(--charcoal);letter-spacing:.1em;text-decoration:none}
        .lp-navcta{font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--charcoal-soft);text-decoration:none;padding-bottom:3px;border-bottom:1px solid var(--stone);transition:color .25s,border-color .25s;background:none;border-left:none;border-top:none;border-right:none;cursor:pointer}
        .lp-navcta:hover{color:var(--clay);border-color:var(--clay)}
        .lp-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:140px 40px 80px;position:relative;overflow:hidden}
        .lp-hero::before{content:'';position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(221,186,166,.35) 0%,transparent 70%);pointer-events:none}
        .hero-eyebrow{font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--clay);margin-bottom:28px;opacity:0;animation:lpFadeUp .9s ease .1s forwards;position:relative;z-index:1}
        .hero-headline{font-family:'Cormorant Garamond',serif;font-size:clamp(48px,7vw,84px);font-weight:300;line-height:1.08;color:var(--charcoal);margin-bottom:24px;max-width:760px;opacity:0;animation:lpFadeUp .9s ease .25s forwards;position:relative;z-index:1}
        .hero-headline em{font-style:italic;color:var(--clay)}
        .hero-situations{display:flex;flex-direction:column;gap:5px;margin-bottom:32px;opacity:0;animation:lpFadeUp .9s ease .38s forwards;position:relative;z-index:1}
        .hero-situation{font-family:'Cormorant Garamond',serif;font-size:clamp(15px,2vw,18px);font-style:italic;color:var(--charcoal-soft);line-height:1.5}
        .hero-situation::before{content:'-- ';color:var(--blush-deep)}
        .hero-sub{font-size:16px;line-height:1.75;color:var(--charcoal-soft);max-width:440px;margin:0 auto 36px;opacity:0;animation:lpFadeUp .9s ease .5s forwards;position:relative;z-index:1}
        .primary-btn{display:inline-block;background:var(--clay);color:white;border:none;border-radius:6px;padding:17px 40px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;position:relative;overflow:hidden;transition:transform .15s;text-decoration:none;box-shadow:0 6px 32px rgba(28,22,20,.12)}
        .primary-btn::before{content:'';position:absolute;inset:0;background:var(--clay-dark);transform:scaleX(0);transform-origin:left;transition:transform .35s ease}
        .primary-btn:hover::before{transform:scaleX(1)}
        .primary-btn:hover{transform:translateY(-1px)}
        .primary-btn span{position:relative;z-index:1}
        .hero-cta-wrap{opacity:0;animation:lpFadeUp .9s ease .62s forwards;position:relative;z-index:1;margin-bottom:12px}
        .form-microcopy{font-size:12px;color:var(--stone);letter-spacing:.04em;opacity:0;animation:lpFadeUp .9s ease .72s forwards;position:relative;z-index:1}
        .hero-cards{position:relative;width:100%;max-width:680px;height:190px;margin:52px auto 0;opacity:0;animation:lpFadeUp .9s ease .84s forwards;z-index:1}
        .hcard{position:absolute;background:white;border-radius:18px;padding:18px 24px;box-shadow:0 10px 40px rgba(28,22,20,.09),0 2px 8px rgba(28,22,20,.04);will-change:transform}
        .hcard:nth-child(1){width:230px;left:0;top:20px;transform:rotate(-3deg)}
        .hcard:nth-child(2){width:250px;left:50%;top:0;transform:translateX(-50%) rotate(.5deg)}
        .hcard:nth-child(3){width:222px;right:0;top:28px;transform:rotate(2.5deg)}
        .hcard-label{font-size:9px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--clay);margin-bottom:7px}
        .hcard-text{font-family:'Cormorant Garamond',serif;font-size:15px;line-height:1.55;color:var(--charcoal)}
        .hcard-text em{font-style:italic;color:var(--charcoal-soft)}
        .section-demo{background:var(--section-alt);padding:96px 48px}
        .demo-inner{max-width:780px;margin:0 auto;text-align:center}
        .section-label{font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--clay);margin-bottom:16px}
        .demo-headline{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,4vw,48px);font-weight:300;line-height:1.15;color:var(--charcoal);margin-bottom:12px}
        .demo-headline em{font-style:italic}
        .demo-sub{font-size:15px;color:var(--charcoal-soft);line-height:1.7;margin-bottom:48px;max-width:500px;margin-left:auto;margin-right:auto}
        .demo-box{background:white;border-radius:16px;padding:36px 40px;box-shadow:0 8px 48px rgba(28,22,20,.08);text-align:left}
        .demo-prompt-label{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--stone);margin-bottom:12px}
        .demo-pills{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px}
        .demo-pill{background:var(--section-alt);border:1px solid var(--blush-deep);border-radius:100px;padding:10px 18px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;color:var(--charcoal-soft);cursor:pointer;transition:background .2s,border-color .2s,color .2s}
        .demo-pill:hover{background:var(--blush);border-color:var(--clay-light);color:var(--charcoal)}
        .demo-pill.selected{background:var(--charcoal);border-color:var(--charcoal);color:white;font-style:normal}
        .demo-result{min-height:100px;border-top:1px solid var(--blush-deep);padding-top:24px}
        .demo-result-label{font-size:10px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--clay);margin-bottom:12px}
        .demo-result-msg{font-family:'Cormorant Garamond',serif;font-size:clamp(17px,2.2vw,21px);font-weight:400;line-height:1.6;color:var(--charcoal);margin-bottom:12px}
        .demo-result-why{font-size:12px;color:var(--stone);line-height:1.6;font-style:italic;margin-bottom:16px}
        .section-how{background:var(--warm-white);padding:96px 48px}
        .section-how-inner{max-width:920px;margin:0 auto}
        .section-headline{font-family:'Cormorant Garamond',serif;font-size:clamp(34px,4vw,52px);font-weight:300;line-height:1.15;color:var(--charcoal);margin-bottom:64px}
        .section-headline em{font-style:italic}
        .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:48px}
        .step-num{font-family:'Cormorant Garamond',serif;font-size:60px;font-weight:300;color:var(--blush-deep);line-height:1;margin-bottom:16px}
        .step-title{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:400;color:var(--charcoal);margin-bottom:10px}
        .step-body{font-size:14px;line-height:1.75;color:var(--charcoal-soft)}
        .step-body strong{font-weight:500;color:var(--charcoal)}
        .section-cta{background:var(--blush);padding:120px 48px;text-align:center;position:relative;overflow:hidden}
        .section-cta::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,var(--blush-deep) 0%,transparent 65%)}
        .cta-inner{position:relative;z-index:2;max-width:520px;margin:0 auto}
        .cta-headline{font-family:'Cormorant Garamond',serif;font-size:clamp(40px,5vw,62px);font-weight:300;line-height:1.15;color:var(--charcoal);margin-bottom:16px}
        .cta-headline em{font-style:italic;color:var(--clay-dark)}
        .cta-sub{font-size:16px;line-height:1.75;color:var(--charcoal-soft);margin-bottom:12px}
        .cta-decision{font-family:'Cormorant Garamond',serif;font-size:20px;font-style:italic;color:var(--charcoal-soft);margin-bottom:40px}
        .cta-microcopy{font-size:12px;color:var(--stone);letter-spacing:.04em;margin-top:14px}
        .section-faq{background:var(--section-alt);padding:96px 48px}
        .faq-inner{max-width:640px;margin:0 auto}
        .faq-list{display:flex;flex-direction:column;margin-top:40px}
        .faq-item{border-bottom:1px solid var(--blush-deep)}
        .faq-q{width:100%;background:none;border:none;text-align:left;padding:18px 0;font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:400;color:var(--charcoal);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:14px}
        .faq-arrow{width:16px;height:16px;flex-shrink:0;transition:transform .3s ease;color:var(--clay)}
        .faq-a{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .3s ease;font-size:13px;line-height:1.8;color:var(--charcoal-soft)}
        .faq-a.open{max-height:200px;padding-bottom:18px}
        .lp-footer{background:var(--charcoal);padding:44px 48px;display:flex;justify-content:space-between;align-items:center}
        .footer-logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#EDE8E3;letter-spacing:.1em}
        .footer-links{display:flex;gap:28px}
        .footer-link{font-size:12px;color:var(--charcoal-soft);text-decoration:none;transition:color .2s}
        .footer-link:hover{color:var(--clay-light)}
        .footer-note{font-size:11px;color:rgba(138,120,112,.5)}
        .lp-reveal{opacity:0;transform:translateY(20px);transition:opacity .7s ease,transform .7s ease}
        .lp-reveal.lp-visible{opacity:1;transform:translateY(0)}
        .lp-stat{opacity:0;transform:translateX(-10px);transition:opacity .7s ease,transform .7s ease}
        .lp-stat.lp-visible{opacity:1;transform:translateX(0)}
        .section-truth{background:var(--charcoal);padding:100px 48px;position:relative;overflow:hidden}
        .truth-geo{position:absolute;border-radius:50%;border:1px solid rgba(216,150,122,.1);pointer-events:none}
        .truth-geo-1{width:400px;height:400px;top:-100px;right:-100px}
        .truth-geo-2{width:620px;height:620px;top:-200px;right:-200px}
        .truth-inner{max-width:960px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start}
        .truth-label{font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--clay);margin-bottom:24px}
        .truth-headline{font-family:'Cormorant Garamond',serif;font-size:clamp(34px,3.5vw,50px);font-weight:300;line-height:1.2;color:#EDE8E3}
        .truth-headline em{font-style:italic;color:var(--clay-light)}
        .truth-bridge{margin-top:24px;font-size:14px;line-height:1.8;color:#7A6E68}
        .stat-item{border-left:2px solid var(--clay-dark);padding:0 0 36px 24px}
        .stat-item:last-child{padding-bottom:0}
        .stat-number{font-family:'Cormorant Garamond',serif;font-size:46px;font-weight:300;color:var(--clay-light);line-height:1;margin-bottom:6px}
        .stat-label{font-size:13px;color:#7A6E68;line-height:1.55}
        .stat-source{font-size:10px;color:rgba(122,110,104,.55);margin-top:4px;letter-spacing:.04em}
        @keyframes lpFadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes anewSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes anewFadeIn{from{opacity:0}to{opacity:1}}
        .anew-overlay{animation:anewFadeIn .25s ease}
        .anew-panel{animation:anewSlideUp .35s cubic-bezier(.32,.72,0,1)}
        @media(max-width:768px){
          .lp-nav{padding:20px 24px}
          .lp-hero{padding:110px 24px 60px}
          .hero-cards{height:260px}
          .hcard:nth-child(3){display:none}
          .hcard:nth-child(1){width:190px}
          .hcard:nth-child(2){width:200px;top:100px}
          .section-demo,.section-truth,.section-how,.section-faq,.section-cta{padding:72px 24px}
          .truth-inner{grid-template-columns:1fr;gap:52px}
          .steps{grid-template-columns:1fr;gap:36px}
          .demo-box{padding:24px 20px}
          .lp-footer{flex-direction:column;gap:20px;text-align:center;padding:40px 24px}
          .footer-links{justify-content:center}
        }
      `}</style>

      {/* ── LP CONTENT ── */}
      <nav className="lp-nav">
        <a href="#" className="lp-logo">Anew</a>
        <button className="lp-navcta" onClick={openApp}>Start privately</button>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <p className="hero-eyebrow">Based on Gottman Method · 40+ years of clinical research</p>
        <h1 className="hero-headline">You still love them.<br />You{"'"}ve just lost the <em>words.</em></h1>
        <div className="hero-situations">
          <span className="hero-situation">Conversations feel shorter than they used to.</span>
          <span className="hero-situation">You stopped reaching for each other.</span>
          <span className="hero-situation">You{"'"}ve been thinking about bringing it up for weeks.</span>
        </div>
        <p className="hero-sub">Start rebuilding connection — one small step at a time.<br />No partner needed. A first step before therapy.</p>
        <div className="hero-cta-wrap">
          <button className="primary-btn" onClick={openApp}><span>Start privately</span></button>
        </div>
        <p className="form-microcopy">No partner needed · No commitment · Leave anytime</p>
        <div className="hero-cards" ref={cardsRef}>
          <div className="hcard"><p className="hcard-label">What you feel</p><p className="hcard-text">I reach for them at night.<br /><em>They don{"'"}t move.</em></p></div>
          <div className="hcard"><p className="hcard-label">What Anew helps you say</p><p className="hcard-text">"I{"'"}ve been missing feeling close to you."</p></div>
          <div className="hcard"><p className="hcard-label">Today{"'"}s step</p><p className="hcard-text">One compliment — not what they do, but who they are.</p></div>
        </div>
      </section>

      {/* DEMO */}
      <section className="section-demo">
        <div className="demo-inner">
          <p className="section-label lp-reveal">Try it now</p>
          <h2 className="demo-headline lp-reveal">What would you <em>actually</em> say?</h2>
          <p className="demo-sub lp-reveal">Pick the situation closest to yours.</p>
          <div className="demo-box lp-reveal">
            <p className="demo-prompt-label">My situation right now...</p>
            <div className="demo-pills">
              {["最近、距離を感じる", "向こうから誘ってこない", "同じことで何度も喧嘩する", "もう話せなくなった"].map((t, i) => (
                <button key={i} className={`demo-pill${demoIdx === i ? " selected" : ""}`} onClick={() => setDemoIdx(i)}>{t}</button>
              ))}
            </div>
            {demoIdx !== null && (
              <div className="demo-result">
                <p className="demo-result-label">今夜送れるメッセージ</p>
                <p className="demo-result-msg">{demoData[demoIdx].msg}</p>
                <p className="demo-result-why">{demoData[demoIdx].why}</p>
                <button className="primary-btn" onClick={openApp}><span>あなた専用のメッセージを作る — 無料</span></button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TRUTH */}
      <section className="section-truth">
        <div className="truth-geo truth-geo-1" /><div className="truth-geo truth-geo-2" />
        <div className="truth-inner">
          <div className="lp-reveal">
            <p className="truth-label">The gap no one talks about</p>
            <h2 className="truth-headline">Most couples wait <em>6 years</em> before getting help.</h2>
            <p className="truth-bridge">Couples therapy works — but cost, wait times, and stigma keep most people from ever getting there.<br /><br />Anew isn{"'"}t therapy. It{"'"}s what happens in that 6-year gap.</p>
          </div>
          <div>
            {[{ n: "6 yrs", l: "Average wait before seeking couples therapy", s: "Journal of Marital and Family Therapy" }, { n: "40%", l: "of couples stop therapy due to cost — $150–300/session", s: "American Psychological Association" }, { n: "1 in 3", l: "Americans live in areas with insufficient mental health providers", s: "HRSA" }].map((s, i) => (
              <div key={i} className="lp-stat stat-item" style={{ transitionDelay: `${i * 0.15}s` }}>
                <p className="stat-number">{s.n}</p>
                <p className="stat-label">{s.l}</p>
                <p className="stat-source">{s.s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="section-how">
        <div className="section-how-inner">
          <p className="section-label lp-reveal">How it works</p>
          <h2 className="section-headline lp-reveal">Not a therapist.<br /><em>A bridge to one.</em></h2>
          <div className="steps">
            {[{ n: "01", t: "You talk. Anew listens.", b: "No judgment, no generic advice. Share what's really going on. Anew reflects it back in a way that makes it <strong>clearer, not heavier.</strong>" }, { n: "02", t: "See what's happening.", b: "Based on 40+ years of Gottman research, Anew identifies patterns <strong>without blaming either of you.</strong>" }, { n: "03", t: "One small step, today.", b: "<strong>A message you can send tonight.</strong> Small things, often — that's what research says works." }].map((s, i) => (
              <div key={i} className="step lp-reveal">
                <p className="step-num">{s.n}</p>
                <h3 className="step-title">{s.t}</h3>
                <p className="step-body" dangerouslySetInnerHTML={{ __html: s.b }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-faq">
        <div className="faq-inner">
          <p className="section-label lp-reveal">Questions</p>
          <h2 className="section-headline lp-reveal" style={{ fontSize: "clamp(28px,3vw,38px)", marginBottom: 0 }}>Things people ask <em>before</em> joining.</h2>
          <div className="faq-list">
            {faqData.map((f, i) => (
              <div key={i} className="faq-item lp-reveal">
                <button className="faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  {f.q}
                  <svg className="faq-arrow" style={{ transform: faqOpen === i ? "rotate(180deg)" : undefined }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className={`faq-a${faqOpen === i ? " open" : ""}`}>{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-cta">
        <div className="cta-inner">
          <h2 className="cta-headline lp-reveal">You deserve to feel <em>wanted</em> again.</h2>
          <p className="cta-sub lp-reveal">Early access is free. Founding members keep their rate.</p>
          <p className="cta-decision lp-reveal">You don{"'"}t need to fix everything today. Just start.</p>
          <div className="lp-reveal">
            <button className="primary-btn" onClick={openApp}><span>Start privately</span></button>
            <p className="cta-microcopy">No partner needed · No commitment · Leave anytime</p>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <span className="footer-logo">Anew</span>
        <div className="footer-links">
          <a href="#" className="footer-link">Privacy</a>
          <a href="#" className="footer-link">Terms</a>
          <a href="#" className="footer-link">Contact</a>
        </div>
        <span className="footer-note">© 2026 Anew · anewapp.net</span>
      </footer>

      {/* ── APP OVERLAY ── */}
      {showOverlay && (
        <div className="anew-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(28,22,20,.55)", backdropFilter: "blur(6px)" }} onClick={() => phase === "chat" ? setPhase("idle") : undefined} />
          <div className="anew-panel" style={{ position: "relative", width: "100%", maxWidth: 480, height: "92vh", background: "#FAF6F1", borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -12px 60px rgba(28,22,20,.25)" }}>

            {/* CHAT PHASE */}
            {(phase === "chat") && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid #DBBAA6", background: "#FAF6F1" }}>
                  <button onClick={() => setPhase("idle")} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A7870", fontSize: 20, lineHeight: 1 }}>×</button>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 400, letterSpacing: ".1em", color: "#1C1614" }}>Anew</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 4 }}>{[0, 1, 2].map((i) => <Dot key={i} active={phaseProgress[phase]} idx={i} />)}</div>
                  </div>
                  <div style={{ width: 24 }} />
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                      <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? "#B8704E" : "white", color: m.role === "user" ? "white" : "#1C1614", fontSize: 14, lineHeight: 1.6, boxShadow: m.role === "assistant" ? "0 2px 8px rgba(28,22,20,.06)" : "none" }}>{m.content}</div>
                    </div>
                  ))}
                  {loading && <TypingDots />}
                  {showQuick && !loading && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 0 8px" }}>
                      {QUICK_REPLIES.map((r) => (
                        <button key={r} onClick={() => sendMessage(r)} style={{ fontSize: 12, padding: "8px 14px", borderRadius: 100, border: "1px solid #DBBAA6", background: "white", color: "#5C4D45", cursor: "pointer" }}>{r}</button>
                      ))}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                <div style={{ padding: "12px 16px 20px", borderTop: "1px solid #DBBAA6", background: "#FAF6F1" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }} placeholder="ここに気持ちを話してください..." rows={1} style={{ flex: 1, resize: "none", borderRadius: 20, border: "1.5px solid #DBBAA6", background: "white", padding: "12px 16px", fontSize: 14, color: "#1C1614", outline: "none", fontFamily: "'DM Sans',sans-serif", maxHeight: 100 }} />
                    <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} style={{ width: 44, height: 44, borderRadius: "50%", background: input.trim() && !loading ? "#B8704E" : "#DBBAA6", border: "none", cursor: input.trim() && !loading ? "pointer" : "default", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .2s" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12 2 3v7l15 2-15 2v7z" /></svg>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* CONFIRM PHASE */}
            {phase === "confirm" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F5EFE8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8704E" strokeWidth="1.5"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /><path d="M12 8v4m0 4h.01" /></svg>
                </div>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: "#1C1614", marginBottom: 16, lineHeight: 1.3 }}>
                  ここまで話してくださって、<br />ありがとうございます。
                </h2>
                <p style={{ fontSize: 15, color: "#5C4D45", lineHeight: 1.75, marginBottom: 40, maxWidth: 320 }}>
                  あなたの状況をもとに、何が起きているのかを整理します。準備ができたら教えてください。
                </p>
                <button onClick={handleConfirm} style={{ width: "100%", maxWidth: 320, padding: "18px 0", borderRadius: 100, background: "#B8704E", color: "white", border: "none", fontSize: 15, fontWeight: 500, cursor: "pointer", letterSpacing: ".03em" }}>
                  はい、整理してください
                </button>
                <button onClick={() => setPhase("chat")} style={{ marginTop: 16, background: "none", border: "none", fontSize: 13, color: "#8A7870", cursor: "pointer", textDecoration: "underline" }}>
                  もう少し話す
                </button>
              </div>
            )}

            {/* PAYWALL PHASE */}
            {phase === "paywall" && (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "24px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 400, letterSpacing: ".1em" }}>Anew</div>
                  <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((i) => <Dot key={i} active={1} idx={i} />)}</div>
                </div>
                <div style={{ padding: "32px 24px 0" }}>
                  <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: "#B8704E", marginBottom: 12 }}>Pattern identified</p>
                  <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 400, color: "#1C1614", lineHeight: 1.25, marginBottom: 8 }}>なぜ辛かったのか、<br />わかってきた。</h2>
                  <p style={{ fontSize: 14, color: "#8A7870", marginBottom: 28 }}>あなたの話から、このパターンが見えています。</p>

                  {pattern && (
                    <div style={{ background: "white", borderRadius: 20, padding: "24px 20px", boxShadow: "0 4px 24px rgba(28,22,20,.08)", marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: "#B8704E", marginBottom: 8 }}>{pattern.tag}</p>
                      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 400, color: "#1C1614", marginBottom: 12 }}>{pattern.label}</h3>
                      <p style={{ fontSize: 14, color: "#5C4D45", lineHeight: 1.7 }}>{pattern.desc}</p>
                    </div>
                  )}

                  <div style={{ background: "#F5EFE8", borderRadius: 16, padding: "20px", marginBottom: 28 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#8A7870", marginBottom: 12, letterSpacing: ".08em" }}>今夜できることを用意しました</p>
                    {["パートナーへのメッセージ案 3つ", "あなただけでできるアクション", "ゴットマン理論に基づいた解説"].map((t, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#B8704E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                        </div>
                        <span style={{ fontSize: 13, color: "#5C4D45" }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "0 24px 32px", marginTop: "auto" }}>
                  <button onClick={() => setPhase("suggestions")} style={{ width: "100%", padding: "18px 0", borderRadius: 100, background: "#B8704E", color: "white", border: "none", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
                    今夜の一歩を見る →
                  </button>
                  <p style={{ textAlign: "center", fontSize: 11, color: "#8A7870", marginTop: 12 }}>ベータ期間中は無料 · 早期メンバーは価格を永続維持</p>
                </div>
              </div>
            )}

            {/* SUGGESTIONS PHASE */}
            {phase === "suggestions" && (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "24px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 400, letterSpacing: ".1em" }}>Anew</div>
                  <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((i) => <Dot key={i} active={2} idx={i} />)}</div>
                </div>
                <div style={{ padding: "28px 20px 0" }}>
                  <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 400, color: "#1C1614", lineHeight: 1.25, marginBottom: 6 }}>今夜できる、<br />小さな一歩。</h2>
                  <p style={{ fontSize: 14, color: "#8A7870", marginBottom: 24 }}>ひとつ選んで、試してみてください。</p>

                  {sugLoading ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "#8A7870", fontSize: 14 }}>提案を考えています...</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => setSelected(i)} style={{ textAlign: "left", padding: "20px", borderRadius: 20, border: selected === i ? "2.5px solid #B8704E" : "2px solid transparent", background: selected === i ? "#FDF8F5" : "white", cursor: "pointer", boxShadow: "0 2px 16px rgba(28,22,20,.07)", transition: "all .2s", position: "relative" }}>
                          {selected === i && (
                            <div style={{ position: "absolute", top: 16, right: 16, width: 22, height: 22, borderRadius: "50%", background: "#B8704E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                            </div>
                          )}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: s.type === "message" ? "#B8704E" : "#F5EFE8", color: s.type === "message" ? "white" : "#B8704E", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 100, marginBottom: 12 }}>
                            {s.type === "message" ? "✉ メッセージ" : "✦ アクション"}
                          </span>
                          <p style={{ fontSize: 16, color: "#1C1614", lineHeight: 1.65, marginBottom: 14, fontWeight: 400 }}>{s.text}</p>
                          <div style={{ borderTop: "1px solid #F0E8E2", paddingTop: 12 }}>
                            <p style={{ fontSize: 12, color: "#8A7870", lineHeight: 1.6, fontStyle: "italic" }}>
                              <span style={{ fontStyle: "normal", marginRight: 4 }}>💡</span>{s.why}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selected !== null && (
                  <div style={{ padding: "0 20px 32px", marginTop: "auto" }}>
                    <button onClick={handleSuggestionAction} style={{ width: "100%", padding: "18px 0", borderRadius: 100, background: copied ? "#5E8A60" : "#B8704E", color: "white", border: "none", fontSize: 15, fontWeight: 500, cursor: "pointer", transition: "background .3s" }}>
                      {copied ? "コピーしました ✓" : suggestions[selected]?.type === "message" ? "メッセージをコピーする" : "これを試してみる"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DONE PHASE */}
            {phase === "done" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 28px 36px" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#F5EFE8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B8704E" strokeWidth="1.5"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 400, color: "#1C1614", lineHeight: 1.2, marginBottom: 14 }}>一歩、<br />踏み出せました。</h2>
                  <p style={{ fontSize: 14, color: "#5C4D45", lineHeight: 1.8, marginBottom: 40 }}>小さな行動が、関係を少しずつ変えていきます。<br />焦らず、自分のペースで。</p>
                </div>

                <div style={{ background: "white", borderRadius: 20, padding: "24px", marginBottom: 24, boxShadow: "0 2px 16px rgba(28,22,20,.06)" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#1C1614", marginBottom: 16, textAlign: "center" }}>次はいつ振り返りますか？</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {["今夜もう一度", "明日", "3日後", "1週間後"].map((label) => (
                      <button key={label} onClick={() => setNextCheckIn(label)} style={{ padding: "12px 8px", borderRadius: 12, border: nextCheckIn === label ? "2px solid #B8704E" : "1.5px solid #DBBAA6", background: nextCheckIn === label ? "#FDF8F5" : "white", color: nextCheckIn === label ? "#B8704E" : "#5C4D45", fontSize: 13, fontWeight: nextCheckIn === label ? 500 : 400, cursor: "pointer", transition: "all .2s" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {nextCheckIn && (
                    <p style={{ fontSize: 12, color: "#8A7870", textAlign: "center", marginTop: 14 }}>
                      📅 {nextCheckIn}に振り返りを設定しました
                    </p>
                  )}
                </div>

                <button onClick={() => { sessionStorage.removeItem("situation"); setPhase("idle"); setMessages([{ role: "assistant", content: INITIAL_MSG }]); setTurnCount(0); setShowQuick(true); setSelected(null); setNextCheckIn(null); setSuggestions([]); }} style={{ background: "none", border: "none", fontSize: 13, color: "#8A7870", cursor: "pointer", textDecoration: "underline", textAlign: "center" }}>
                  最初からやり直す
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
