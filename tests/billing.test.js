const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePlan, isValidIdempotencyKey, isTestStripeSecret } = require('../lib/billing-validation');

test('accepts only the configured subscription plan names', () => {
  assert.equal(parsePlan('monthly'), 'monthly');
  assert.equal(parsePlan('annual'), 'annual');
  assert.equal(parsePlan('wallet-transfer'), null);
  assert.equal(parsePlan(''), null);
  assert.equal(parsePlan(undefined), null);
});

test('rejects malformed or missing idempotency keys', () => {
  assert.equal(isValidIdempotencyKey('pushit-checkout-12345678'), true);
  assert.equal(isValidIdempotencyKey(''), false);
  assert.equal(isValidIdempotencyKey('short'), false);
  assert.equal(isValidIdempotencyKey('a'.repeat(129)), false);
  assert.equal(isValidIdempotencyKey('has spaces 12345'), false);
});

test('accepts only Stripe test-mode secret keys while the safety lock is active', () => {
  assert.equal(isTestStripeSecret('sk_test_example'), true);
  assert.equal(isTestStripeSecret('sk_live_example'), false);
  assert.equal(isTestStripeSecret(''), false);
  assert.equal(isTestStripeSecret(undefined), false);
});
