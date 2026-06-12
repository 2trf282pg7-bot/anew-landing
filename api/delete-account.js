const { createClient } = require('@supabase/supabase-js');

// Permanently deletes the authenticated user's data and auth account.
// Requires the service role key to bypass RLS and remove the auth user.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server not configured for deletion' });

  const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

  try {
    // Verify the caller
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    const uid = user.id;

    // Collect the user's sessions and projects to delete their children first
    const { data: sessions } = await supabase.from('sessions').select('id').eq('user_id', uid);
    const sessionIds = (sessions || []).map(s => s.id);

    const { data: projects } = await supabase.from('projects').select('id').eq('user_id', uid);
    const projectIds = (projects || []).map(p => p.id);

    if (sessionIds.length) {
      await supabase.from('messages').delete().in('session_id', sessionIds);
    }
    if (projectIds.length) {
      await supabase.from('actions').delete().in('project_id', projectIds);
      await supabase.from('checkins').delete().in('project_id', projectIds);
    }
    await supabase.from('projects').delete().eq('user_id', uid);
    await supabase.from('sessions').delete().eq('user_id', uid);
    await supabase.from('users').delete().eq('id', uid);

    // Finally remove the auth user
    const { error: delErr } = await supabase.auth.admin.deleteUser(uid);
    if (delErr) console.error('delete-account: auth user delete error:', delErr.message);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete-account error:', err);
    res.status(500).json({ error: err.message });
  }
};

/*
  ── Manual test (C-8) ──
  1. Needs SUPABASE_SERVICE_ROLE_KEY. POST with a valid Bearer token.
     Expect 200 { ok: true }; the user's messages/actions/checkins/projects/sessions/users
     rows are gone and the auth user is removed.
  2. Missing/invalid token -> 401. No service key -> 500.
*/
