"use client";

type Suggestion = {
  type: "message" | "action";
  text: string;
  why: string;
};

type Props = {
  suggestion: Suggestion;
  selected: boolean;
  onSelect: () => void;
};

export default function SuggestionCard({ suggestion, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all bg-white ${
        selected ? "border-clay" : "border-transparent shadow-sm"
      }`}
    >
      <span
        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${
          suggestion.type === "message"
            ? "bg-clay text-white"
            : "bg-section-alt text-clay"
        }`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {suggestion.type === "message" ? "メッセージ" : "アクション"}
      </span>
      <p
        className="text-sm text-charcoal leading-relaxed mb-2"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {suggestion.text}
      </p>
      <p
        className="text-xs text-stone"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {suggestion.why}
      </p>
    </button>
  );
}
