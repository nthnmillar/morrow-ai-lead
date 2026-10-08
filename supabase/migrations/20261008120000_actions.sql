create table public.actions (
  id uuid primary key default gen_random_uuid(),
  enquiry_id text not null references public.enquiries(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  type text not null check (type = 'draft_reply'),
  status text not null default 'proposed' check (status in ('proposed', 'edited', 'approved', 'cancelled')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  proposed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by_user_at timestamptz,
  rejected_at timestamptz,
  executed_at timestamptz,
  error_message text,
  unique (analysis_id)
);

create index actions_enquiry_proposed_at_idx
  on public.actions (enquiry_id, proposed_at desc);

alter table public.actions enable row level security;

-- Only the server-side service role can create, restore, or review Actions.
revoke all on table public.actions from anon, authenticated;
grant select, insert, update on table public.actions to service_role;
