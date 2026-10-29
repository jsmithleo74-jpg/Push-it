const { getBillingConfig, serviceClient, getAuthenticatedUser, json } = require('../../lib/billing');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  if (!getBillingConfig().ready) return json(res, 503, { error: 'billing_not_configured', subscriptionBillingEnabled: false });
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.user) return json(res, 401, { error: auth.error });
    const { data, error } = await serviceClient().from('pushit_subscriptions')
      .select('status,price_id,current_period_end,cancel_at_period_end,updated_at')
      .eq('auth_subject', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return json(res, 200, { subscriptionBillingEnabled: true, subscription: data || null });
  } catch (error) {
    console.error('Push It billing status error', { code: error.code || 'unknown' });
    return json(res, 500, { error: 'billing_status_unavailable' });
  }
};
