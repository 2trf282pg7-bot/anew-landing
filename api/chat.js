const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `あなたはAnew（リレーションシップサポートアプリ）のAIです。ゴットマンメソッドと動機づけ面接（MI）に基づいています。

役割：
- 傾聴と感情の反射のみ行う。アドバイス・解決策・提案は絶対にしない。
- 返答は必ず2〜3文以内。短く、温かく、自然な日本語。
- 感情ラベル化：「〜という気持ちがあるんですね」「それは〜と感じているということでしょうか」
- 体験の正常化：「そういう状況は、多くのカップルが経験することです」
- 毎回、一つだけ優しい問いを返す
- 「わかります」とは言わない`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  const filtered = messages.filter(
    (m) => m.content !== null && m.content !== undefined && m.content !== ""
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: filtered,
  });

  const reply = response.content[0]?.text ?? "";
  return res.status(200).json({ reply });
};
