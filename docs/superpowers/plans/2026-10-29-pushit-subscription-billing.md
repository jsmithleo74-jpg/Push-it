# Push It Subscription Billing Backend Implementation Plan

> **For agentic workers:** Use this checklist to finish the implementation safely. Do not merge or enable live money movement until every release gate is verified.

**Goal:** Add authenticated Stripe subscription billing for Push It without enabling P2P transfers, payouts, or stored-wallet money movement.

**Architecture:** Vercel serverless routes create Stripe-hosted subscription Checkout and Customer Portal sessions. Auth0 RS256 access tokens bind requests to a stable Auth0 subject; Supabase stores server-side customer mappings, subscription state, and idempotent webhook receipts under RLS. Stripe remains separate from Moov/P2P flows.

**Tech Stack:** Node.js, Vercel Functions, Stripe SDK, Auth0 JWKS/JWT verification, Supabase Postgres, Node built-in test runner.

**Spec:** This implementation plan and the requirements in the Pull Request description.

## Global Constraints

- Stripe billing is test-mode-only while the test-mode lock is active.
- Never expose Stripe secret keys or the Supabase service-role key to clients.
- Never use Stripe subscription checkout as the P2P transfer or wallet-ledger rail.
- Preserve existing records; schema changes are additive or limited to the newly created, empty billing tables.
- Do not enable live money movement until provider readiness, ledger, idempotency, signed webhooks, reconciliation, risk controls, and end-to-end tests pass.

## Review Focus

- Missing or malformed Auth0 bearer token must be rejected.
- Wrong issuer/audience or non-RS256 token must be rejected.
- Missing test Stripe secrets/prices or wrong-mode key must fail closed.
- Invalid plans and invalid idempotency keys must be rejected before creating a Checkout Session.
- Duplicate or failed webhook delivery must not duplicate subscription state or silently mark an unprocessed event complete.

---

### Task 1: Billing input validation

**Files:** `lib/billing-validation.js`, `tests/billing.test.js`

- [x] Write tests first and observe the missing-module failure.
- [x] Implement strict monthly/annual plan allowlist and idempotency-key validation.
- [x] Run the unit tests; both tests pass in the local Node test runner.

### Task 2: Authenticated subscription API

**Files:** `lib/billing.js`, `api/billing/checkout.js`, `api/billing/portal.js`, `api/billing/status.js`

- [x] Use Auth0 JWKS verification with issuer, audience, and RS256 algorithm checks.
- [x] Keep Stripe configured for test mode only.
- [x] Implement authenticated checkout, customer portal, and subscription status routes.
- [ ] Configure the exact Auth0 API audience in Vercel and exercise valid/invalid bearer-token requests.

### Task 3: Webhook persistence and database security

**Files:** `api/billing/webhook.js`, `supabase/migrations/202610290001_pushit_billing.sql`, `supabase/migrations/202610290002_pushit_billing_auth0_identity.sql`

- [x] Verify Stripe webhook signatures against the raw request body.
- [x] Persist event receipts and subscription state with upserts.
- [x] Apply migrations to the configured Supabase project.
- [x] Verify billing tables exist, RLS is enabled, and only the server service role has table privileges.
- [ ] Send signed Stripe test events and verify subscription state changes and duplicate-event handling.

### Task 4: Deployment and release verification

- [x] Add a test-mode lock to the consolidated Vercel project.
- [x] Deploy the feature branch to a Vercel preview and confirm it reaches READY.
- [x] Verify `GET /api/status` returns `livePaymentsEnabled: false`.
- [x] Verify billing status fails closed with HTTP 503 while required configuration is missing.
- [x] Verify checkout, portal, and webhook reject GET requests with HTTP 405.
- [ ] Configure Stripe test-mode key, recurring test Price IDs, webhook secret, Auth0 audience, and server-only Supabase service-role key.
- [ ] Complete an authenticated Stripe test Checkout and signed webhook round trip.
- [ ] Review and merge the pull request only after the missing release gates pass.
- [ ] Keep live P2P money movement disabled until Moov and the financial ledger are independently verified.
