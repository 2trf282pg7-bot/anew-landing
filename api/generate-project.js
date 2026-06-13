const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const SYSTEM_PROMPT = `You are the clinical reasoning engine of Anew, an AI relationship support tool. You design personalized 90-day recovery projects using evidence-based frameworks: Gottman Method, Emotionally Focused Therapy (EFT), Motivational Interviewing (MI), Sensate Focus, CBT, and Integrative Behavioral Couple Therapy (IBCT).

You will receive a conversation between Anew and a user describing their relationship situation. Follow these steps IN ORDER.

STEP 0 — SAFETY GATE (always evaluate first)
Scan the entire conversation for:
- Physical violence, threats, intimidation, or coercive control by either partner
- Self-harm or suicidal ideation
- Symptoms suggesting severe mental illness requiring professional care (psychosis, inability to function in daily life)
If ANY of these are present, do NOT generate a project. Output ONLY:
{"status":"refer","message":"<2-4 warm, non-judgmental sentences. Acknowledge their courage in sharing. Explain that what they described needs support beyond what Anew can responsibly provide. Do not minimize or diagnose.>","resources":[{"name":"National Domestic Violence Hotline","contact":"1-800-799-7233"},{"name":"988 Suicide & Crisis Lifeline","contact":"988"}]}
Include only the resources relevant to what was disclosed.

STEP 1 — SUFFICIENCY GATE
Check whether the conversation clearly establishes at least 4 of these 6:
(1) What is happening (2) How long it has been going on (3) What the user has already tried (4) How the partner typically responds (5) What the user is most afraid of (6) What the user actually wants
If fewer than 4 are present, do NOT generate a project. Output ONLY:
{"status":"needs_more","questions":["<question 1>","<question 2>"]}
Questions must be warm, specific to what is missing, and phrased the way Anew speaks: plain language, no jargon, one thing at a time.

STEP 2 — THEORY SELECTION
Choose primary and supporting frameworks based on the actual pattern, not by default:
- MI: user shows ambivalence, low confidence in change, or "what's the point" resignation
- EFT: core pain is rejection, feeling unwanted, feeling invisible, attachment fear
- Gottman: recurring fights, criticism/contempt/defensiveness/stonewalling patterns
- Sensate Focus: physical intimacy has stopped or become pressured. HARD RULE: never schedule Sensate Focus or any physical-touch tasks before Week 5, and only after groundwork weeks exist
- CBT: distorted automatic thoughts ("they'll always say no", "I'm not attractive anymore")
- IBCT: years of accumulated resentment; mix of acceptance work and change work
HARD RULE: Weeks 1-3 contain internal work only (self-understanding, emotion labeling, pattern observation). No partner-facing actions before Week 4.

STEP 3 — PERSONALIZATION REQUIREMENTS
The project MUST:
- Quote the user's own words at least 3 times, in quotation marks
- Reference at least 2 concrete facts they shared (events, durations, partner behaviors)
- Name their stated fear explicitly in pattern_analysis
- Never feel like a template. If two different users could receive this same project, it has failed.

STEP 4 — TONE
Interpretation, never diagnosis. Use "I may be seeing...", "This pattern is often associated with...". Never blame either partner. Never use clinical labels for the user ("anxious attachment", "codependent"). Warm, plain, unhurried.

STEP 5 — OUTPUT SCHEMA
If STEP 0 and STEP 1 pass, output ONLY this JSON (no other text, no markdown fences):
{
  "status":"ok",
  "pattern_analysis":{
    "primary_pattern":"string",
    "contributing_factors":["string"],
    "strengths":["string — real strengths evidenced in the conversation"]
  },
  "project_title":"string",
  "project_summary":"string (2-3 sentences, must reference their specific situation)",
  "roadmap":[
    {"week_range":"Wk 1-3","focus":"string","theory":"string","theory_rationale":"string (why this theory for THIS user)","tasks":[{"title":"string","description":"string","frequency":"daily|weekly|once","theory_basis":"string"}]},
    {"week_range":"Wk 4-7", ...},
    {"week_range":"Wk 8-10", ...},
    {"week_range":"Wk 11-13", ...}
  ],
  "first_week_task":{"title":"string","description":"string","theory_basis":"string"}
}
The roadmap must have exactly these 4 phases.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id, user_id, adjustment_note, force } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  // ── Auth gate (item 24): verify Bearer token and confirm it matches user_id ──
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
  if (!user_id || user.id !== user_id) return res.status(401).json({ error: 'User mismatch' });

  // Link the onboarding session to this user (service role bypasses RLS). The client
  // cannot: an authenticated user has no SELECT policy for an unlinked session, so a
  // client-side `update ... where id=` matches 0 rows. Only claim orphans (user_id IS
  // NULL) so a session can't be hijacked by passing someone else's id. This also lets
  // the inline needs_more chat persist its turns and fixes History linking (D-10).
  try {
    await supabase.from('sessions').update({ user_id }).eq('id', session_id).is('user_id', null);
  } catch (e) { console.error('[generate-project] session claim failed:', e?.message); }

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
      ? `\n\nThe user has reviewed a previous version of the project and requested the following changes:\n"${adjustment_note}"\nIncorporate these changes into the new project. The safety and sufficiency gates still apply.`
      : '';

    // Force path (E-1/F-1): the user has already been asked for more detail, so the
    // client builds anyway. Never dead-end on needs_more here. STEP 0 still applies.
    const forceSection = force
      ? '\n\nIMPORTANT: The user has already been asked for more detail. You MUST NOT return needs_more. Skip STEP 1 (the sufficiency gate) entirely. Build the best 90-day project you can from whatever is available; if the conversation is thin, make reasonable, clearly general choices rather than refusing. STEP 0 (safety) still applies.'
      : '';

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Conversation:\n${conversation}${adjustmentSection}${forceSection}`,
      }],
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generate-project] Model output contained no JSON object. Raw model text:\n' + raw);
      throw new Error('The model did not return a usable project. Please try again.');
    }
    let project;
    try {
      project = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[generate-project] Failed to parse model JSON (' + parseErr.message + '). Raw model text:\n' + raw);
      throw new Error('The model returned malformed data. Please try again.');
    }

    // ── Gate handling (items 1-3): refer / needs_more are returned, never saved ──
    if (project.status === 'refer') {
      return res.status(200).json({
        status: 'refer',
        message: project.message,
        resources: project.resources || [],
      });
    }
    if (project.status === 'needs_more') {
      return res.status(200).json({
        status: 'needs_more',
        questions: project.questions || [],
      });
    }

    // Normalize roadmap so existing renderers that read theory_explanation keep working
    const roadmap = (project.roadmap || []).map(p => ({
      ...p,
      theory_rationale: p.theory_rationale || p.theory_explanation || '',
      theory_explanation: p.theory_rationale || p.theory_explanation || '',
    }));

    const insertData = {
      user_id: user_id || null,
      pattern_analysis: project.pattern_analysis,
      recovery_plan: {
        roadmap,
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

    // Strip the model's status; return our own shape plus the saved id
    res.status(200).json({
      status: 'ok',
      pattern_analysis: project.pattern_analysis,
      project_title: project.project_title,
      project_summary: project.project_summary,
      roadmap,
      first_week_task: project.first_week_task,
      project_id: saved?.id,
    });
  } catch (err) {
    console.error('generate-project error:', err);
    res.status(500).json({ error: err.message });
  }
};

/*
  ── Manual test ──
  1. Set ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
  2. needs_more: POST with a session whose messages are sparse (one vague line).
     Expect 200 { status:"needs_more", questions:[...] } and NO new row in `projects`.
  3. refer: seed a session that mentions self-harm or violence.
     Expect 200 { status:"refer", message, resources:[...] } and NO new row in `projects`.
  4. ok: seed a session covering >=4 of the 6 sufficiency points.
     Expect 200 { status:"ok", roadmap (4 phases), project_id } and a new `projects` row (status='pending').
  5. Auth: omit Authorization header -> 401. Send user_id different from the token's user -> 401.
*/
