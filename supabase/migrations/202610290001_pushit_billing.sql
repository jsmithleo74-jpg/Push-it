-- Push It subscription billing only. No P2P transfers or wallet balances are implemented here.
create table if not exists public.pushit_billing_customers (
  auth_subject text primary key,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pushit_subscriptions (
  stripe_subscription_id text primary key,
  auth_subject text not null,
  stripe_customer_id text not null,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pushit_subscriptions_auth_subject_updated_idx
  on public.pushit_subscriptions(auth_subject, updated_at desc);

create table if not exists public.pushit_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null check (status in ('processing', 'processed', 'failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pushit_billing_customers enable row level security;
alter table public.pushit_subscriptions enable row level security;
alter table public.pushit_webhook_events enable row level security;

-- Auth0 is the app identity provider. These tables are server-only; the API verifies Auth0 tokens,
-- and the service-role backend performs reads/writes. No client-side table access is granted.
revoke all on public.pushit_billing_customers from anon, authenticated;
revoke all on public.pushit_subscriptions from anon, authenticated;
revoke all on public.pushit_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.pushit_billing_customers to service_role;
grant select, insert, update, delete on public.pushit_subscriptions to service_role;
grant select, insert, update, delete on public.pushit_webhook_events to service_role;
