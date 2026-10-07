create table public.enquiries (
  id text primary key,
  source text not null check (source in ('Website form', 'Email')),
  company_name text not null,
  contact_name text not null,
  email text not null,
  original_text text not null,
  created_at timestamptz not null,
  status text not null check (status in ('awaiting_review', 'needs_information', 'responded', 'analysis_failed'))
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  enquiry_id text not null references public.enquiries(id) on delete cascade,
  status text not null default 'validated' check (status = 'validated'),
  model_output_json jsonb not null check (jsonb_typeof(model_output_json) = 'object'),
  created_at timestamptz not null default now()
);

create index analyses_enquiry_created_at_idx
  on public.analyses (enquiry_id, created_at desc);

-- Browser clients receive no table policies; only the server-side persistence client can write.
alter table public.enquiries enable row level security;
alter table public.analyses enable row level security;

-- Explicit grants expose only the server-required tables when automatic Data API exposure is disabled.
grant usage on schema public to service_role;
grant insert on table public.enquiries to service_role;
grant select, insert on table public.analyses to service_role;
