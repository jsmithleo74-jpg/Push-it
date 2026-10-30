module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const secretConfigured = Boolean(process.env.MOOV_SECRET_KEY);
  const publicConfigured = Boolean(process.env.MOOV_PUBLIC_KEY);
  return res.status(secretConfigured && publicConfigured ? 200 : 503).json({
    service: 'Push It',
    provider: 'Moov',
    credentialsConfigured: secretConfigured && publicConfigured,
    checks: {
      secretKeyPresent: secretConfigured,
      publicKeyPresent: publicConfigured,
      providerAuthentication: 'not_verified',
      webhookVerification: 'not_verified',
      ledgerAndReconciliation: 'not_verified'
    },
    liveMoneyMovementEnabled: false,
    message: 'This endpoint checks configuration presence only. It does not contact Moov or authorize financial actions.'
  });
};
