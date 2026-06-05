const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  async function sendEmail(to, subject, html) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Anew <hello@anewapp.net>',
        to,
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Resend error: ${txt}`);
    }
    return r.json();
  }

  const results = { task_reminders: 0, checkin_reminders: 0, errors: [] };

  try {
    // ── Task reminders: send on day 3 of each week ──
    const { data: activeProjects } = await supabase
      .from('projects')
      .select('id, user_id, project_title, first_week_task, roadmap, started_at')
      .eq('status', 'active');

    for (const project of activeProjects || []) {
      if (!project.user_id || !project.started_at) continue;
      const startDate = new Date(project.started_at);
      const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      const dayOfWeek = diffDays % 7;
      if (dayOfWeek !== 3) continue; // only on day 3 of each week

      const { data: user } = await supabase.auth.admin.getUserById(project.user_id);
      if (!user?.user?.email) continue;
      const email = user.user.email;
      const name = email.split('@')[0];

      const currentWeekIndex = Math.floor(diffDays / 7);
      const phase = project.roadmap?.[Math.min(currentWeekIndex, (project.roadmap?.length || 1) - 1)];
      const tasks = phase?.tasks?.slice(0, 3) || [];
      const taskList = tasks.map(t => `<li style="margin-bottom:8px">${t.title}</li>`).join('');

      try {
        await sendEmail(email,
          `Your check-in for this week, ${name}`,
          `<!DOCTYPE html><html><body style="font-family:'DM Sans',sans-serif;background:#FAF6F1;margin:0;padding:32px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px">
  <h1 style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:28px;color:#1C1614;margin-bottom:8px">Anew</h1>
  <p style="color:#5C4D45;font-size:14px;margin-bottom:24px">This week's focus: <strong>${phase?.focus || ''}</strong></p>
  <h2 style="font-size:18px;color:#1C1614;margin-bottom:12px">Your tasks this week</h2>
  <ul style="color:#1C1614;font-size:15px;padding-left:20px;margin-bottom:28px">${taskList}</ul>
  <a href="https://anewapp.net/dashboard.html" style="display:block;background:#B8704E;color:white;text-align:center;padding:16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase">Open Anew</a>
  <p style="font-size:11px;color:#8A7870;margin-top:20px;text-align:center">Anew is not a substitute for professional therapy or medical advice.</p>
</div>
</body></html>`
        );
        results.task_reminders++;
      } catch (e) { results.errors.push(e.message); }
    }

    // ── Check-in reminders: send the day before scheduled check-in ──
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: checkins } = await supabase
      .from('checkins')
      .select('user_id, scheduled_at')
      .gte('scheduled_at', tomorrowStr + 'T00:00:00')
      .lt('scheduled_at', tomorrowStr + 'T23:59:59')
      .eq('reminder_sent', false);

    for (const checkin of checkins || []) {
      const { data: user } = await supabase.auth.admin.getUserById(checkin.user_id);
      if (!user?.user?.email) continue;
      const email = user.user.email;
      const scheduledDate = new Date(checkin.scheduled_at);
      const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      try {
        await sendEmail(email,
          'Your Anew session is tomorrow',
          `<!DOCTYPE html><html><body style="font-family:'DM Sans',sans-serif;background:#FAF6F1;margin:0;padding:32px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px">
  <h1 style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:28px;color:#1C1614;margin-bottom:8px">Anew</h1>
  <p style="color:#5C4D45;font-size:15px;margin-bottom:8px">Your next session is scheduled for tomorrow.</p>
  <p style="font-size:20px;font-weight:500;color:#1C1614;margin-bottom:28px">${scheduledDate.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} at ${timeStr}</p>
  <a href="https://anewapp.net/dashboard.html" style="display:block;background:#B8704E;color:white;text-align:center;padding:16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase">Start my session</a>
  <p style="font-size:11px;color:#8A7870;margin-top:20px;text-align:center">Anew is not a substitute for professional therapy or medical advice.</p>
</div>
</body></html>`
        );

        await supabase
          .from('checkins')
          .update({ reminder_sent: true })
          .eq('user_id', checkin.user_id)
          .eq('scheduled_at', checkin.scheduled_at);

        results.checkin_reminders++;
      } catch (e) { results.errors.push(e.message); }
    }

    res.status(200).json({ ok: true, ...results });
  } catch (err) {
    console.error('send-reminder error:', err);
    res.status(500).json({ error: err.message });
  }
};
