const MOOV_API = 'https://api.moov.io';
const MOOV_VERSION = 'v2026.07.00';

function getMoovConfig(env = process.env) {
  return {
    clientId: env.MOOV_PUBLIC_KEY || '',
    clientSecret: env.MOOV_SECRET_KEY || ''
  };
}

async function createMoovAccessToken({ clientId, clientSecret, fetchImpl = fetch }) {
  if (!clientId || !clientSecret) {
    const error = new Error('moov_credentials_missing');
    error.code = 'moov_credentials_missing';
    throw error;
  }

  const response = await fetchImpl(`${MOOV_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Moov-Version': MOOV_VERSION },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      client_type: 'service',
      scope: '/ping.read'
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error('moov_token_request_failed');
    error.code = 'moov_token_request_failed';
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  if (!payload || typeof payload.access_token !== 'string' || !payload.access_token) {
    const error = new Error('moov_token_response_invalid');
    error.code = 'moov_token_response_invalid';
    throw error;
  }
  return payload.access_token;
}

async function verifyMoovAuthentication({ env = process.env, fetchImpl = fetch } = {}) {
  const config = getMoovConfig(env);
  if (!config.clientId || !config.clientSecret) {
    return { configured: false, authenticated: false, reason: 'credentials_missing' };
  }

  try {
    const token = await createMoovAccessToken({ ...config, fetchImpl });
    const ping = await fetchImpl(`${MOOV_API}/ping`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'X-Moov-Version': MOOV_VERSION },
      signal: AbortSignal.timeout(10000)
    });
    if (!ping.ok) {
      return { configured: true, authenticated: false, reason: 'ping_rejected', providerStatus: ping.status };
    }
    return { configured: true, authenticated: true, reason: 'ping_succeeded' };
  } catch (error) {
    return {
      configured: true,
      authenticated: false,
      reason: error.code || 'provider_unreachable',
      ...(Number.isInteger(error.status) ? { providerStatus: error.status } : {})
    };
  }
}

module.exports = { getMoovConfig, createMoovAccessToken, verifyMoovAuthentication };
