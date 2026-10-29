const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function parsePlan(value) {
  return value === 'monthly' || value === 'annual' ? value : null;
}

function isValidIdempotencyKey(value) {
  return typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

function getBillingConfig() {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_ANNUAL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL'
  ];
  const missing = required.filter((key) => !process.env[key]);
  const mode = process.env.STRIPE_EXPECTED_MODE;
  if (mode !== 'test') missing.push('STRIPE_EXPECTED_MODE=test (test-mode lock)');
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
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

async function getAuthenticatedUser(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { user: null, error: 'missing_bearer_token' };
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data || !data.user) return { user: null, error: 'invalid_session' };
  return { user: data.user, error: null };
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
