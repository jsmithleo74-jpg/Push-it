const {
  getBillingConfig, stripeClient, serviceClient, getAuthenticatedUser, json, appBaseUrl
} = require('../../lib/billing');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  const config = getBillingConfig();
  if (!config.ready) return json(res, 503, { error: 'billing_not_configured' });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.user) return json(res, 401, { error: auth.error });
    const db = serviceClient();
    const { data, error } = await db.from('pushit_billing_customers')
      .select('stripe_customer_id').eq('user_id', auth.user.id).maybeSingle();
    if (error) throw error;
    if (!data || !data.stripe_customer_id) return json(res, 404, { error: 'billing_customer_not_found' });

    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: appBaseUrl()
    });
    return json(res, 200, { url: session.url, mode: 'test' });
  } catch (error) {
    console.error('Push It billing portal error', { code: error.code || 'unknown', type: error.type || 'unknown' });
    return json(res, 500, { error: 'billing_portal_unavailable' });
  }
};
