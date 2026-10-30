function parsePlan(value) {
  return value === 'monthly' || value === 'annual' ? value : null;
}

function isValidIdempotencyKey(value) {
  return typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

function isTestStripeSecret(value) {
  return typeof value === 'string' && value.startsWith('sk_test_');
}

module.exports = { parsePlan, isValidIdempotencyKey, isTestStripeSecret };
