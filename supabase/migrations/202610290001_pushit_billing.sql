-- Push It subscription billing only. This schema does not implement P2P transfers or wallet balances.
create table if not exists public.pushit_billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pushit_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pushit_subscriptions_user_id_updated_idx
  on public.pushit_subscriptions(user_id, updated_at desc);

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

-- No client policies for customer mappings or webhook receipts. Service-role backend only.
-- The authenticated app may read only its own subscription record if this table is queried directly.
drop policy if exists pushit_subscriptions_select_own on public.pushit_subscriptions;
create policy pushit_subscriptions_select_own
  on public.pushit_subscriptions for select to authenticated
  using (auth.uid() = user_id);

grant select on public.pushit_subscriptions to authenticated;
grant select, insert, update, delete on public.pushit_billing_customers to service_role;
grant select, insert, update, delete on public.pushit_subscriptions to service_role;
grant select, insert, update, delete on public.pushit_webhook_events to service_role;
revoke all on public.pushit_billing_customers from anon, authenticated;
revoke all on public.pushit_webhook_events from anon, authenticated;
