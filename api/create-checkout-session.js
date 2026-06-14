const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { session_id } = req.body;

  const origin = req.headers.origin
    || req.headers.referer?.replace(/\/[^/]*$/, '')
    || 'https://anewapp.net';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Anew — Relationship Recovery' },
          unit_amount: 1900,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { anew_session_id: session_id || '' },
      },
      metadata: { anew_session_id: session_id || '' },
      success_url: `${origin}/register.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
};
