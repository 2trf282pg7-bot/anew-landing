const { createClient } = require('@supabase/supabase-js');

// Test-only endpoint: fires the Day-3 or Day-6 trial email for a single user on
// demand. Mirrors the logic in api/send-reminder.js but ignores the sent-flag
// guards and never flips them, so it's safe to run repeatedly.
module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Same CRON_SECRET bearer check as the real cron.
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else {
    return res.status(401).json({ error: 'CRON_SECRET not configured' });
  }

  const type = req.query.type;
  const email = req.query.email;
  if (type !== 'day3' && type !== 'day6') {
    return res.status(400).json({ error: "type must be 'day3' or 'day6'" });
  }
  if (!email) {
    return res.status(400).json({ error: 'email query param required' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

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
    // Target only the requested user (matched by the ?email= query param).
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, email, trial_started_at')
      .eq('email', email)
      .limit(1);
    if (userErr) throw new Error(userErr.message);

    const u = users?.[0];
    if (!u) return res.status(404).json({ error: `No user found with email ${email}` });

    const name = u.email.split('@')[0];

    if (type === 'day3') {
      // Day 3 — warm reminder of this week's tasks (no sent-flag check/update).
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
    } else {
      // Day 6 — explicit end-of-trial + billing notice (no sent-flag check/update).
      await sendEmail(u.email,
        'Your Anew trial ends tomorrow',
        emailShell(
          `<p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:16px">Your free trial ends tomorrow. After that, your Anew subscription begins at <strong>$19/month</strong>, billed to the card you provided, and renews monthly until you cancel.</p>
  <p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:16px">If Anew isn't the right fit right now, you can cancel any time before tomorrow and you won't be charged. To cancel, open Anew, go to your account menu, and choose "Cancel subscription." It takes effect immediately and you keep access through the end of your trial.</p>
  <p style="color:#5C4D45;font-size:15px;line-height:1.6;margin-bottom:24px">Either way, we're glad you started.</p>`
        )
      );
    }

    return res.status(200).json({ success: true, emailSent: true, to: email, type });
  } catch (err) {
    console.error('test-reminder error:', err);
    return res.status(500).json({ error: err.message });
  }
};
