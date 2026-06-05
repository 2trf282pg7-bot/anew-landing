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
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { stripe_session_id } = req.body;
    if (!stripe_session_id) return res.status(400).json({ error: 'stripe_session_id required' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const checkoutSession = await stripe.checkout.sessions.retrieve(stripe_session_id);

    if (checkoutSession.payment_status !== 'paid' && checkoutSession.subscription === null) {
      // Trial — payment not required yet
    }

    const customerId = checkoutSession.customer;
    const subscriptionId = checkoutSession.subscription;

    await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: 'trial',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('link-checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
