const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Stripe signature verification requires the raw, unparsed request body.
// Disabling Vercel's body parser is mandatory here — otherwise verification always fails.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Map Stripe subscription status -> Anew subscription_status
function mapStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'trialing': return 'trial';
    case 'active': return 'active';
    case 'past_due': return 'past_due';
    case 'unpaid': return 'past_due';
    case 'canceled': return 'canceled';
    case 'incomplete_expired': return 'canceled';
    default: return stripeStatus;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  async function setStatusBySubscription(subscriptionId, status, extra = {}) {
    if (!subscriptionId) return;
    const { error } = await supabase
      .from('users')
      .update({ subscription_status: status, updated_at: new Date().toISOString(), ...extra })
      .eq('stripe_subscription_id', subscriptionId);
    if (error) console.error('webhook DB update error:', error);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await setStatusBySubscription(sub.id, mapStatus(sub.status));
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await setStatusBySubscription(sub.id, 'canceled', { canceled_at: new Date().toISOString() });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await setStatusBySubscription(invoice.subscription, 'past_due');
        break;
      }
      default:
        // Ignore other event types
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
};

/*
  ── Manual test (item 25) ──
  1. In Stripe Dashboard create a webhook endpoint -> https://anewapp.net/api/webhook
     subscribed to customer.subscription.updated, customer.subscription.deleted,
     invoice.payment_failed. Copy its signing secret to STRIPE_WEBHOOK_SECRET.
  2. `stripe listen --forward-to localhost:3000/api/webhook` then
     `stripe trigger invoice.payment_failed` -> the matching users row flips to past_due.
  3. `stripe trigger customer.subscription.deleted` -> row flips to canceled.
  4. Send a request with a bad/missing stripe-signature header -> 400 (verification fails).
*/
