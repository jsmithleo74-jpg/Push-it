const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { parsePlan, isValidIdempotencyKey, isTestStripeSecret } = require('./billing-validation');

function getBillingConfig() {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_ANNUAL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AUTH0_DOMAIN',
    'AUTH0_AUDIENCE',
    'NEXT_PUBLIC_APP_URL'
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (process.env.STRIPE_EXPECTED_MODE !== 'test') missing.push('STRIPE_EXPECTED_MODE=test (test-mode lock)');
  if (process.env.STRIPE_SECRET_KEY && !isTestStripeSecret(process.env.STRIPE_SECRET_KEY)) {
    missing.push('STRIPE_SECRET_KEY must be a test-mode key while the test-mode lock is active');
  }
  return { ready: missing.length === 0, missing };
}

function stripeClient() {
  const config = getBillingConfig();
  if (!config.ready) {
    const error = new Error('Billing is not configured for safe test mode');
    error.code = 'billing_not_configured';
    throw error;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function serviceClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

let auth0Jwks;
function getAuth0Jwks() {
  const domain = (process.env.AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain || !process.env.AUTH0_AUDIENCE) throw new Error('Auth0 API audience is not configured');
  if (!auth0Jwks) auth0Jwks = jwksClient({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10
  });
  return { client: auth0Jwks, domain };
}

async function getAuthenticatedUser(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { user: null, error: 'missing_bearer_token' };
  try {
    const { client, domain } = getAuth0Jwks();
    const token = match[1];
    const payload = await new Promise((resolve, reject) => {
      jwt.verify(token, (header, callback) => {
        if (!header || !header.kid) return callback(new Error('missing_kid'));
        client.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          callback(null, key.getPublicKey());
        });
      }, {
        algorithms: ['RS256'],
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${domain}/`
      }, (err, decoded) => err ? reject(err) : resolve(decoded));
    });
    if (!payload || typeof payload.sub !== 'string') return { user: null, error: 'invalid_session' };
    return { user: { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null }, error: null };
  } catch {
    return { user: null, error: 'invalid_session' };
  }
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}

module.exports = {
  parsePlan,
  isValidIdempotencyKey,
  getBillingConfig,
  stripeClient,
  serviceClient,
  getAuthenticatedUser,
  json,
  appBaseUrl
};
