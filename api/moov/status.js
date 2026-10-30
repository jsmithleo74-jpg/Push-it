const { verifyMoovAuthentication } = require('../../lib/moov');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const auth = await verifyMoovAuthentication();
  const ready = auth.authenticated === true;
  return res.status(ready ? 200 : 503).json({
    service: 'Push It',
    provider: 'Moov',
    credentialsConfigured: auth.configured,
    checks: {
      secretKeyPresent: Boolean(process.env.MOOV_SECRET_KEY),
      publicKeyPresent: Boolean(process.env.MOOV_PUBLIC_KEY),
      providerAuthentication: ready ? 'verified' : 'not_verified',
      providerPing: auth.reason,
      transferScope: 'not_verified',
      sourceAndDestinationPaymentMethods: 'not_verified',
      accountCapabilities: 'not_verified',
      webhookVerification: 'not_verified',
      ledgerAndReconciliation: 'not_verified'
    },
    liveMoneyMovementEnabled: false,
    message: ready
      ? 'Moov authentication and read-only ping succeeded. Transfer prerequisites remain unverified; money movement stays disabled.'
      : 'Moov authentication could not be verified. Money movement stays disabled.'
  });
};
