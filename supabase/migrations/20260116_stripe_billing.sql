-- Stripe Billing Schema
-- Purpose: Track subscriptions, payment methods, and billing history
-- Migration: 20260116_stripe_billing

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Subscriptions table: Track Stripe subscription state
create table if not exists stripe_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  
  -- Stripe identifiers
  stripe_customer_id text not null,
  stripe_subscription_id text unique not null,
  stripe_price_id text not null,
  
  -- Subscription details
  plan text not null check (plan in ('free', 'pro', 'business', 'enterprise')),
  status text not null check (status in ('active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused')),
  
  -- Billing cycle
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  
  -- Pricing
  amount_cents integer not null,
  currency text not null default 'usd',
  interval text not null check (interval in ('month', 'year')),
  
  -- Trial
  trial_start timestamptz,
  trial_end timestamptz,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  unique(organization_id, stripe_subscription_id)
);

-- Payment methods table: Track customer payment methods
create table if not exists stripe_payment_methods (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_payment_method_id text unique not null,
  
  -- Payment method details
  type text not null check (type in ('card', 'bank_account', 'sepa_debit', 'us_bank_account')),
  is_default boolean not null default false,
  
  -- Card details (if type = 'card')
  card_brand text, -- visa, mastercard, amex, etc.
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  
  -- Bank details (if type = 'bank_account' or 'us_bank_account')
  bank_name text,
  bank_last4 text,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invoice history table: Track billing history
create table if not exists stripe_invoices (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_invoice_id text unique not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  
  -- Invoice details
  status text not null check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_due_cents integer not null,
  amount_paid_cents integer not null default 0,
  currency text not null default 'usd',
  
  -- Dates
  invoice_date timestamptz not null,
  due_date timestamptz,
  paid_at timestamptz,
  
  -- Links
  invoice_pdf_url text,
  hosted_invoice_url text,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Billing events log: Audit trail for all billing events
create table if not exists stripe_events (
  id uuid primary key default uuid_generate_v4(),
  stripe_event_id text unique not null,
  event_type text not null,
  organization_id uuid references organizations(id) on delete set null,
  
  -- Event data
  data jsonb not null,
  processed boolean not null default false,
  error_message text,
  
  -- Metadata
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Indexes for performance
create index if not exists idx_stripe_subscriptions_org_id on stripe_subscriptions(organization_id);
create index if not exists idx_stripe_subscriptions_stripe_customer_id on stripe_subscriptions(stripe_customer_id);
create index if not exists idx_stripe_subscriptions_status on stripe_subscriptions(status);
create index if not exists idx_stripe_subscriptions_current_period_end on stripe_subscriptions(current_period_end);

create index if not exists idx_stripe_payment_methods_org_id on stripe_payment_methods(organization_id);
create index if not exists idx_stripe_payment_methods_stripe_customer_id on stripe_payment_methods(stripe_customer_id);
create index if not exists idx_stripe_payment_methods_is_default on stripe_payment_methods(is_default) where is_default = true;

create index if not exists idx_stripe_invoices_org_id on stripe_invoices(organization_id);
create index if not exists idx_stripe_invoices_stripe_customer_id on stripe_invoices(stripe_customer_id);
create index if not exists idx_stripe_invoices_status on stripe_invoices(status);
create index if not exists idx_stripe_invoices_invoice_date on stripe_invoices(invoice_date desc);

create index if not exists idx_stripe_events_event_type on stripe_events(event_type);
create index if not exists idx_stripe_events_processed on stripe_events(processed) where processed = false;
create index if not exists idx_stripe_events_org_id on stripe_events(organization_id);
create index if not exists idx_stripe_events_created_at on stripe_events(created_at desc);

-- Row Level Security (RLS)
alter table stripe_subscriptions enable row level security;
alter table stripe_payment_methods enable row level security;
alter table stripe_invoices enable row level security;
alter table stripe_events enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Users can view own organization subscriptions" on stripe_subscriptions;
drop policy if exists "Users can view own organization payment methods" on stripe_payment_methods;
drop policy if exists "Users can view own organization invoices" on stripe_invoices;
drop policy if exists "Users can view own organization events" on stripe_events;
drop policy if exists "Service role can manage subscriptions" on stripe_subscriptions;
drop policy if exists "Service role can manage payment methods" on stripe_payment_methods;
drop policy if exists "Service role can manage invoices" on stripe_invoices;
drop policy if exists "Service role can manage events" on stripe_events;

-- RLS Policies: Users can view their own organization's billing data
create policy "Users can view own organization subscriptions"
  on stripe_subscriptions for select
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
    )
  );

create policy "Users can view own organization payment methods"
  on stripe_payment_methods for select
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
    )
  );

create policy "Users can view own organization invoices"
  on stripe_invoices for select
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
    )
  );

create policy "Users can view own organization events"
  on stripe_events for select
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
    )
  );

-- Service role can insert/update all billing data (used by webhooks)
create policy "Service role can manage subscriptions"
  on stripe_subscriptions for all
  using (auth.jwt()->>'role' = 'service_role');

create policy "Service role can manage payment methods"
  on stripe_payment_methods for all
  using (auth.jwt()->>'role' = 'service_role');

create policy "Service role can manage invoices"
  on stripe_invoices for all
  using (auth.jwt()->>'role' = 'service_role');

create policy "Service role can manage events"
  on stripe_events for all
  using (auth.jwt()->>'role' = 'service_role');

-- Triggers for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop existing triggers if they exist (for idempotency)
drop trigger if exists update_stripe_subscriptions_updated_at on stripe_subscriptions;
drop trigger if exists update_stripe_payment_methods_updated_at on stripe_payment_methods;
drop trigger if exists update_stripe_invoices_updated_at on stripe_invoices;
drop trigger if exists sync_org_plan_on_subscription_change on stripe_subscriptions;

create trigger update_stripe_subscriptions_updated_at before update on stripe_subscriptions
  for each row execute function update_updated_at_column();

create trigger update_stripe_payment_methods_updated_at before update on stripe_payment_methods
  for each row execute function update_updated_at_column();

create trigger update_stripe_invoices_updated_at before update on stripe_invoices
  for each row execute function update_updated_at_column();

-- Function to get active subscription for organization
create or replace function get_active_subscription(org_id uuid)
returns table (
  subscription_id uuid,
  plan text,
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean
) as $$
begin
  return query
  select 
    id as subscription_id,
    plan,
    status,
    current_period_end,
    cancel_at_period_end
  from stripe_subscriptions
  where organization_id = org_id
    and status in ('active', 'trialing')
  order by current_period_end desc
  limit 1;
end;
$$ language plpgsql security definer;

-- Function to sync organization plan with subscription
create or replace function sync_organization_plan()
returns trigger as $$
begin
  -- Update organization plan when subscription becomes active
  if new.status = 'active' or new.status = 'trialing' then
    update organizations
    set plan = new.plan,
        updated_at = now()
    where id = new.organization_id;
  end if;
  
  -- Downgrade to free when subscription cancelled/expired
  if new.status in ('canceled', 'unpaid', 'incomplete_expired', 'past_due') then
    -- Only downgrade if this is the most recent subscription
    if not exists (
      select 1 from stripe_subscriptions
      where organization_id = new.organization_id
        and status in ('active', 'trialing')
        and current_period_end > new.current_period_end
    ) then
      update organizations
      set plan = 'free',
          updated_at = now()
      where id = new.organization_id;
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger sync_org_plan_on_subscription_change
  after insert or update on stripe_subscriptions
  for each row execute function sync_organization_plan();

-- Comments for documentation
comment on table stripe_subscriptions is 'Tracks Stripe subscription state for organizations';
comment on table stripe_payment_methods is 'Stores customer payment methods from Stripe';
comment on table stripe_invoices is 'Historical record of invoices and payments';
comment on table stripe_events is 'Audit log of all Stripe webhook events';
comment on function get_active_subscription(uuid) is 'Returns the active subscription for an organization';
comment on function sync_organization_plan() is 'Automatically syncs organization.plan with subscription status';
