-- The first draft of these new tables used Supabase Auth UUIDs. Push It uses Auth0,
-- so switch the empty billing tables to Auth0 subject identifiers. No existing billing rows are expected.
alter table public.pushit_billing_customers drop constraint if exists pushit_billing_customers_user_id_fkey;
alter table public.pushit_billing_customers drop constraint if exists pushit_billing_customers_pkey;
alter table public.pushit_billing_customers drop column if exists user_id;
alter table public.pushit_billing_customers add column if not exists auth_subject text;
alter table public.pushit_billing_customers alter column auth_subject set not null;
alter table public.pushit_billing_customers add constraint pushit_billing_customers_pkey primary key (auth_subject);

alter table public.pushit_subscriptions drop constraint if exists pushit_subscriptions_user_id_fkey;
drop policy if exists pushit_subscriptions_select_own on public.pushit_subscriptions;
alter table public.pushit_subscriptions drop column if exists user_id;
alter table public.pushit_subscriptions add column if not exists auth_subject text;
alter table public.pushit_subscriptions alter column auth_subject set not null;
create index if not exists pushit_subscriptions_auth_subject_updated_idx
  on public.pushit_subscriptions(auth_subject, updated_at desc);

revoke all on public.pushit_billing_customers from anon, authenticated;
revoke all on public.pushit_subscriptions from anon, authenticated;
revoke all on public.pushit_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.pushit_billing_customers to service_role;
grant select, insert, update, delete on public.pushit_subscriptions to service_role;
grant select, insert, update, delete on public.pushit_webhook_events to service_role;
