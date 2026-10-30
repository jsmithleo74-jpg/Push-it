# Push It — Tag Pay You're It

Expo / React Native mobile starter and Vercel API routes for Push It.

## Current safety state

- P2P transfers, payouts, wallet balances, and transaction history remain disabled.
- Stripe is for Push It subscription billing only; it must not be used for P2P transfers or stored wallet balances.
- Billing API routes enforce a **test-mode-only lock**: `STRIPE_EXPECTED_MODE=test` and an `sk_test_` secret are required.
- No production/live billing or money movement should be enabled until checkout, signed webhooks, database persistence, authentication, provider approvals, reconciliation, and fraud/risk controls are independently verified.
- Do not place Stripe secrets or the Supabase service-role key in a mobile app or any `NEXT_PUBLIC_*` variable.

## Subscription API routes

- `POST /api/billing/checkout` — authenticated user; JSON body `{"plan":"monthly"}` or `{"plan":"annual"}`; requires an `Idempotency-Key` header of 16–128 letters/numbers/underscores/hyphens. Returns a Stripe-hosted Checkout URL.
- `POST /api/billing/portal` — authenticated user; returns a Stripe Customer Portal URL.
- `GET /api/billing/status` — authenticated user; returns their saved subscription status.
- `POST /api/billing/webhook` — verifies the raw body with `STRIPE_WEBHOOK_SECRET`, processes subscription events, and stores event receipts for idempotency.

All user routes require a valid Auth0 API access token in `Authorization: Bearer <access-token>`. The token's issuer and audience are validated against Auth0 JWKS. Requests return a non-success response until required test-mode configuration exists.

## Required setup before testing

1. For a fresh environment, apply both migrations in order: `202610290001_pushit_billing.sql`, then `202610290002_pushit_billing_auth0_identity.sql`. The configured Supabase project for this app has these tables already created and verified.
2. Configure a Stripe **test-mode** secret key, test-mode monthly and annual recurring Price IDs, and the webhook signing secret for `/api/billing/webhook`.
3. Configure `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel. The service-role key must never be client-exposed.
4. Set `AUTH0_DOMAIN` and the exact `AUTH0_AUDIENCE` configured for your Auth0 API, then set `NEXT_PUBLIC_APP_URL` to the test deployment URL.
5. Set `STRIPE_EXPECTED_MODE=test`, redeploy, then test authenticated checkout, success/cancel return, portal creation, duplicate webhook delivery, subscription update/cancellation, and database persistence.

See `.env.example` for variable names only. It contains placeholders, not usable credentials.

## Local development and tests

- `npm install`
- `npm test`
- `npx expo start`

The unit tests cover billing-plan validation and idempotency-key validation. They do not claim to prove a live Stripe or Supabase integration.

## Mobile builds

Android APK/AAB generation and iOS signing require Expo/EAS build configuration and developer accounts. Store submission also requires privacy disclosures, review assets, and approval.

Primary brand: Push It. Secondary branding: Tag Pay You're It.
