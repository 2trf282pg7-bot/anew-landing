"use client";

type Props = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatBubble({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed font-dm ${
          isUser
            ? "bg-clay text-white rounded-br-sm"
            : "bg-white text-charcoal rounded-bl-sm shadow-sm"
        }`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {content}
      </div>
    </div>
  );
}
