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

  const results = { task_reminders: 0, checkin_reminders: 0, trial_day3: 0, trial_day6: 0, errors: [] };

  const emailShell = (inner) =>
    `<!DOCTYPE html><html><body style="font-family:'DM Sans',sans-serif;background:#FAF6F1;margin:0;padding:32px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px">
  <h1 style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:28px;color:#1C1614;margin-bottom:8px">Anew</h1>
  ${inner}
  <a href="https://anewapp.net/dashboard.html" style="display:block;background:#B8704E;color:white;text-align:center;padding:16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;margin-top:8px">Open Anew</a>
  <p style="font-size:11px;color:#8A7870;margin-top:20px;text-align:center">Anew is not a substitute for professional therapy or medical advice.</p>
</div>
</body></html>`;

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

    // ── Trial nudges (item 14): Day 3 warm reminder, Day 6 end-of-trial notice ──
    const { data: trialUsers } = await supabase
      .from('users')
      .select('id, email, trial_started_at, trial_day3_sent, trial_day6_sent')
      .eq('subscription_status', 'trial')
      .not('trial_started_at', 'is', null);

    for (const u of trialUsers || []) {
      if (!u.email || !u.trial_started_at) continue;
      const startDate = new Date(u.trial_started_at);
      const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      const name = u.email.split('@')[0];

      // Day 3 — warm reminder of this week's tasks
      if (diffDays === 3 && !u.trial_day3_sent) {
        try {
          const { data: projects } = await supabase
            .from('projects')
            .select('roadmap, first_week_task')
            .eq('user_id', u.id)
            .eq('status', 'active')
            .limit(1);
          const phase = projects?.[0]?.roadmap?.[0];
          const tasks = (phase?.tasks || []).slice(0, 3);
          const taskList = tasks.length
            ? `<ul style="color:#1C1614;font-size:15px;padding-left:20px;margin-bottom:24px">${tasks.map(t => `<li style="margin-bottom:8px">${t.title}</li>`).join('')}</ul>`
            : `<p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:24px">Your first week's work is waiting whenever you're ready.</p>`;

          await sendEmail(u.email,
            `How's this week going, ${name}?`,
            emailShell(
              `<p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:16px">A few days into your trial — no pressure, just a gentle nudge. If you have a quiet moment, here's what this week is about${phase?.focus ? `: <strong>${phase.focus}</strong>` : '.'}</p>
  ${taskList}`
            )
          );
          await supabase.from('users').update({ trial_day3_sent: true }).eq('id', u.id);
          results.trial_day3++;
        } catch (e) { results.errors.push(e.message); }
      }

      // Day 6 — explicit end-of-trial + billing notice (FTC: clear, not buried)
      if (diffDays === 6 && !u.trial_day6_sent) {
        try {
          await sendEmail(u.email,
            'Your Anew trial ends tomorrow',
            emailShell(
              `<p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:16px">Your free trial ends tomorrow. After that, your Anew subscription begins at <strong>$19/month</strong>, billed to the card you provided, and renews monthly until you cancel.</p>
  <p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:16px">If Anew isn't the right fit right now, you can cancel any time before tomorrow and you won't be charged. To cancel, open Anew, go to your account menu, and choose "Cancel subscription." It takes effect immediately and you keep access through the end of your trial.</p>
  <p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:24px">Either way, we're glad you started.</p>`
            )
          );
          await supabase.from('users').update({ trial_day6_sent: true }).eq('id', u.id);
          results.trial_day6++;
        } catch (e) { results.errors.push(e.message); }
      }
    }

    res.status(200).json({ ok: true, ...results });
  } catch (err) {
    console.error('send-reminder error:', err);
    res.status(500).json({ error: err.message });
  }
};

/*
  ── Manual test (item 14) ──
  1. Insert a `users` row: subscription_status='trial', trial_started_at = now()-interval '3 days',
     trial_day3_sent=false, with an active project. Hit GET /api/send-reminder.
     Expect a Day-3 email and trial_day3_sent flips to true; a second run sends nothing.
  2. Set trial_started_at = now()-interval '6 days', trial_day6_sent=false. Run again.
     Expect the Day-6 end-of-trial email naming $19/month + how to cancel; trial_day6_sent -> true.
  3. Cron runs daily at 09:00 UTC (vercel.json).
*/
