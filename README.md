# Push It — Tag Pay You're It (Mobile)

Expo / React Native starter for Android and iOS.

## Safety state
This build is a UI preview. It never creates, submits, or retries transfers; it does not fabricate balances or transaction history; it reads only `GET /api/status` from the existing Push It hostname. Payment secrets must remain server-side. It is not production-ready for money movement.

## Run locally
Install a current Node.js LTS release, then run `npm install` and `npx expo start`. Use Expo Go to scan the QR code, or use a device emulator. Check Expo's current SDK compatibility guide before changing package versions.

## Before live financial use
Requires verified authentication, authorization, persistent database, double-entry ledger, idempotency, signed webhooks, provider approvals, fraud/risk controls, reconciliation, account recovery/deletion, privacy policy, and tested funding/payout flows. Do not enable live transfers until implemented and independently tested.

Primary brand: Push It. Tagline: Tag Pay You're It.
