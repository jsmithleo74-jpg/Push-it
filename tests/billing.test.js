const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePlan, isValidIdempotencyKey } = require('../lib/billing');

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
