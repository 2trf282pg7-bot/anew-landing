const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    // Verify session
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    // Look up the Stripe customer
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!userData?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const origin = req.headers.origin
      || req.headers.referer?.replace(/\/[^/]*$/, '')
      || 'https://anewapp.net';

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${origin}/dashboard.html`,
    });

    res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error('billing-portal error:', err);
    res.status(500).json({ error: err.message });
  }
};

/*
  ── Manual test ──
  1. Set STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. In the Stripe
     Dashboard enable the Customer Portal (Settings > Billing > Customer portal).
  2. POST with a valid Bearer access token for a user that has stripe_customer_id.
     Expect 200 { url: "https://billing.stripe.com/..." }.
  3. Omit the Authorization header -> 401. A user without stripe_customer_id -> 400.
  4. In dashboard.html, the past_due banner's "Update payment method" button opens
     this portal (no new Checkout Session is created for past_due users).
*/
