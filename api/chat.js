const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('FATAL hasKey=false — ANTHROPIC_API_KEY missing');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { messages } = req.body;

    const client = new Anthropic({ apiKey });

    const validMessages = (messages || []).filter(
      m => m && m.content && String(m.content).trim() !== ''
    );

    if (validMessages.length === 0) {
      return res.status(400).json({ error: 'No valid messages' });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `あなたはAnew（リレーションシップサポートアプリ）のAIです。ゴットマンメソッドと動機づけ面接（MI）に基づいています。役割：傾聴と感情の反射のみ行う。アドバイス・解決策・提案は絶対にしない。返答は必ず2〜3文以内。短く、温かく、自然な日本語。感情ラベル化：「〜という気持ちがあるんですね」「それは〜と感じているということでしょうか」体験の正常化：「そういう状況は、多くのカップルが経験することです」毎回、一つだけ優しい問いを返す。「わかります」とは言わない。`,
      messages: validMessages
    });

    const reply = response.content[0].text;
    console.log('OK model=claude-sonnet-4-6 chars=' + reply.length);
    return res.status(200).json({ reply });

  } catch (error) {
    // Log as a single line so it shows in Vercel's log viewer
    console.error('ERR ' + (error.status || '?') + ' ' + (error.error?.type || '') + ' ' + error.message.slice(0, 300));
    return res.status(500).json({
      error: error.message,
      type: error.error?.type,
      status: error.status
    });
  }
};
