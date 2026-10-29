const {
  parsePlan, isValidIdempotencyKey, getBillingConfig, stripeClient,
  serviceClient, getAuthenticatedUser, json, appBaseUrl
} = require('../../lib/billing');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  const config = getBillingConfig();
  if (!config.ready) return json(res, 503, { error: 'billing_not_configured', message: 'Subscription checkout is locked until test-mode credentials, Auth0 API audience, prices, and database access are configured.' });

  const idempotencyKey = req.headers['idempotency-key'];
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return json(res, 400, { error: 'invalid_idempotency_key', message: 'Send a unique 16–128 character Idempotency-Key using letters, numbers, underscores, or hyphens.' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid_json' }); }
  }
  const plan = parsePlan(body && body.plan);
  if (!plan) return json(res, 400, { error: 'invalid_plan', allowedPlans: ['monthly', 'annual'] });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.user) return json(res, 401, { error: auth.error });
    const stripe = stripeClient();
    const db = serviceClient();
    const user = auth.user;
    const { data: existing, error: lookupError } = await db
      .from('pushit_billing_customers')
      .select('stripe_customer_id')
      .eq('auth_subject', user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let customerId = existing && existing.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { auth0_sub: user.id, app: 'push-it' }
      }, { idempotencyKey: `pushit-customer-${user.id}` });
      customerId = customer.id;
      const { error: saveError } = await db.from('pushit_billing_customers').upsert({
        auth_subject: user.id,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'auth_subject' });
      if (saveError) throw saveError;
    }

    const priceId = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appBaseUrl()}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl()}/?billing=cancelled`,
      client_reference_id: user.id,
      metadata: { auth0_sub: user.id, plan, app: 'push-it' },
      subscription_data: { metadata: { auth0_sub: user.id, plan, app: 'push-it' } },
      allow_promotion_codes: true
    }, { idempotencyKey: `pushit-checkout-${user.id}-${idempotencyKey}` });
    return json(res, 200, { url: session.url, sessionId: session.id, mode: 'test' });
  } catch (error) {
    console.error('Push It checkout error', { code: error.code || 'unknown', type: error.type || 'unknown' });
    if (error.code === 'billing_not_configured') return json(res, 503, { error: error.code });
    return json(res, 500, { error: 'checkout_unavailable', message: 'Checkout could not be created. No payment was taken.' });
  }
};
