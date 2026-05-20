const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { situation } = req.body;

    if (!situation) {
      return res.status(400).json({ error: 'situation is required' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `ユーザーの状況に合わせて、今夜試せる提案を3つ生成してください。メッセージ（パートナーに送る言葉）でもアクション（ユーザーが一人でできる行動）でも構いません。ルール：各提案は1〜2文以内。責めない・攻めない・プレッシャーをかけない。小さく、今夜すぐできることに限定する。whyはゴットマン理論に基づく一言説明（日本語）。JSONのみ返す（マークダウン不可）：{"suggestions":[{"type":"message","text":"本文","why":"説明"},{"type":"action","text":"行動内容","why":"説明"},{"type":"message","text":"本文","why":"説明"}]}`,
      messages: [{ role: 'user', content: situation }]
    });

    const raw = response.content[0].text;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { suggestions: [] };
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
