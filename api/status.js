module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  return res.status(200).json({
    service: 'Push It',
    branding: { primary: 'Push It', secondary: "Tag Pay You're It" },
    mode: 'preview',
    readiness: 'not_ready_for_money_movement',
    livePaymentsEnabled: false,
    capabilities: { transferCreation: false, payouts: false, balanceReads: false, transactionHistory: false },
    checks: {
      statusEndpoint: 'available',
      authenticatedLedger: 'not_verified',
      providerWebhooks: 'not_verified',
      providerApproval: 'not_verified',
      idempotencyAndReconciliation: 'not_verified'
    },
    message: 'This endpoint reports application readiness only. It does not authorize or execute financial actions.'
  });
};
