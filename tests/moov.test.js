const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyMoovAuthentication } = require('../lib/moov');

function response(status, payload = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

test('verifies Moov credentials by requesting a scoped token and pinging the API', async () => {
  const calls = [];
  const result = await verifyMoovAuthentication({
    env: { MOOV_PUBLIC_KEY: 'public-test', MOOV_SECRET_KEY: 'secret-test' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? response(200, { access_token: 'short-lived-token' }) : response(200, {});
    }
  });
  assert.equal(result.authenticated, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.moov.io/oauth2/token');
  assert.equal(JSON.parse(calls[0].options.body).scope, '/ping.read');
  assert.equal(calls[1].url, 'https://api.moov.io/ping');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer short-lived-token');
});

test('does not call Moov when credentials are missing', async () => {
  let called = false;
  const result = await verifyMoovAuthentication({
    env: {},
    fetchImpl: async () => { called = true; throw new Error('must not call'); }
  });
  assert.deepEqual(result, { configured: false, authenticated: false, reason: 'credentials_missing' });
  assert.equal(called, false);
});

test('reports rejected provider authentication without leaking credentials', async () => {
  let calls = 0;
  const result = await verifyMoovAuthentication({
    env: { MOOV_PUBLIC_KEY: 'public-test', MOOV_SECRET_KEY: 'secret-test' },
    fetchImpl: async () => ++calls === 1 ? response(200, { access_token: 'short-lived-token' }) : response(403, {})
  });
  assert.deepEqual(result, {
    configured: true, authenticated: false, reason: 'ping_rejected', providerStatus: 403
  });
});
