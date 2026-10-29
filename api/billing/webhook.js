const Stripe = require('stripe');
const { getBillingConfig, serviceClient, json } = require('../../lib/billing');

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function syncSubscription(stripe, db, subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  let userId = subscription.metadata && subscription.metadata.supabase_user_id;
  if (!userId) {
    const { data: customerRow, error: customerError } = await db.from('pushit_billing_customers')
      .select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    if (customerError) throw customerError;
    userId = customerRow && customerRow.user_id;
  }
  if (!userId) throw new Error('subscription_user_not_mapped');

  const item = subscription.items && subscription.items.data && subscription.items.data[0];
  const row = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    price_id: item && item.price ? item.price.id : null,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from('pushit_subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  const config = getBillingConfig();
  if (!config.ready) return json(res, 503, { error: 'billing_not_configured' });

  const signature = req.headers['stripe-signature'];
  if (!signature) return json(res, 400, { error: 'missing_signature' });

  let event;
  try {
    const raw = await readRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const status = error.message === 'payload_too_large' ? 413 : 400;
    return json(res, status, { error: 'invalid_webhook' });
  }

  const db = serviceClient();
  try {
    const { error: insertError } = await db.from('pushit_webhook_events').upsert({
      event_id: event.id, event_type: event.type, status: 'processing', updated_at: new Date().toISOString()
    }, { onConflict: 'event_id', ignoreDuplicates: true });
    if (insertError) throw insertError;

    const { data: eventRow, error: eventLookupError } = await db.from('pushit_webhook_events')
      .select('status').eq('event_id', event.id).single();
    if (eventLookupError) throw eventLookupError;
    if (eventRow.status === 'processed') return json(res, 200, { received: true, duplicate: true });

    const obj = event.data && event.data.object;
    if (event.type === 'checkout.session.completed' && obj && obj.subscription) {
      const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
      const subscription = await stripeRetrieveSubscription(subscriptionId);
      await syncSubscription(new Stripe(process.env.STRIPE_SECRET_KEY), db, subscription);
    } else if (event.type.startsWith('customer.subscription.') && obj && obj.id) {
      await syncSubscription(new Stripe(process.env.STRIPE_SECRET_KEY), db, obj);
    } else if ((event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') && obj && obj.subscription) {
      const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
      const subscription = await stripeRetrieveSubscription(subscriptionId);
      await syncSubscription(new Stripe(process.env.STRIPE_SECRET_KEY), db, subscription);
    }

    const { error: doneError } = await db.from('pushit_webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('event_id', event.id);
    if (doneError) throw doneError;
    return json(res, 200, { received: true });
  } catch (error) {
    console.error('Push It webhook processing error', { eventType: event.type, code: error.code || 'unknown' });
    await db.from('pushit_webhook_events').update({
      status: 'failed', updated_at: new Date().toISOString()
    }).eq('event_id', event.id);
    return json(res, 500, { error: 'webhook_processing_failed' });
  }

  async function stripeRetrieveSubscription(id) {
    return new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.retrieve(id);
  }
};
