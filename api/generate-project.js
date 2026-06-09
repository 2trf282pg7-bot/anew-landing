const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id, user_id, adjustment_note } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;
    if (!msgs || msgs.length === 0) throw new Error('No messages found for session');

    const conversation = msgs
      .map(m => `${m.role === 'assistant' ? 'Anew' : 'User'}: ${m.content}`)
      .join('\n');

    const adjustmentSection = adjustment_note
      ? `\n\nThe user has reviewed a previous version and requested the following changes:\n"${adjustment_note}"\nIncorporate these changes into the new plan.`
      : '';

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are an expert relationship therapist using evidence-based methods including Gottman Method, EFT, MI, Sensate Focus, CBT, and IBCT.

Based on the conversation below, create a personalized 90-day recovery project.${adjustmentSection}

Conversation:
${conversation}

Output JSON only, no other text:
{
  "pattern_analysis": {
    "primary_pattern": "string",
    "contributing_factors": ["string"],
    "strengths": ["string"]
  },
  "project_title": "string",
  "project_summary": "string (2-3 sentences)",
  "roadmap": [
    {
      "week_range": "Wk 1-3",
      "focus": "string",
      "theory": "string",
      "theory_explanation": "string (why this theory for this user)",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "frequency": "daily|weekly|once",
          "theory_basis": "string"
        }
      ]
    }
  ],
  "first_week_task": {
    "title": "string",
    "description": "string",
    "theory_basis": "string"
  }
}`
      }]
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const project = JSON.parse(jsonMatch[0]);

    const insertData = {
      user_id: user_id || null,
      pattern_analysis: project.pattern_analysis,
      recovery_plan: {
        roadmap: project.roadmap,
        first_week_task: project.first_week_task,
      },
      project_title: project.project_title,
      project_summary: project.project_summary,
      status: 'pending',
    };

    const { data: saved, error: saveErr } = await supabase
      .from('projects')
      .insert(insertData)
      .select('id')
      .single();

    if (saveErr) console.error('Save project error:', saveErr);

    res.status(200).json({ ...project, project_id: saved?.id });
  } catch (err) {
    console.error('generate-project error:', err);
    res.status(500).json({ error: err.message });
  }
};
