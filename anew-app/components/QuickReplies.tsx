"use client";

const OPTIONS = [
  "最近、距離を感じる",
  "向こうから誘ってこない",
  "同じことで何度も喧嘩する",
  "もう話せなくなった",
];

type Props = {
  onSelect: (text: string) => void;
};

export default function QuickReplies({ onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="text-xs px-3 py-2 rounded-full border border-blush-deep text-charcoal-soft bg-white hover:bg-section-alt transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
