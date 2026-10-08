alter table public.actions
  add column execution_status text check (execution_status in ('pending', 'succeeded', 'failed')),
  add column execution_started_at timestamptz,
  add column provider_message_id text;

-- Existing Stage 2C approvals are safe to execute explicitly, but never execute during migration or page load.
update public.actions
set execution_status = 'pending'
where status = 'approved';

alter table public.actions add constraint actions_execution_state_check check (
  (
    status <> 'approved'
    and execution_status is null
    and execution_started_at is null
    and provider_message_id is null
    and executed_at is null
    and error_message is null
  )
  or (
    status = 'approved'
    and execution_status = 'pending'
    and provider_message_id is null
    and executed_at is null
    and (error_message is null or error_message = 'outcome_unknown')
  )
  or (
    status = 'approved'
    and execution_status = 'succeeded'
    and execution_started_at is not null
    and provider_message_id is not null
    and executed_at is not null
    and error_message is null
  )
  or (
    status = 'approved'
    and execution_status = 'failed'
    and execution_started_at is not null
    and provider_message_id is null
    and executed_at is null
    and error_message in ('configuration_missing', 'provider_rejected')
  )
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  enquiry_id text not null references public.enquiries(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete cascade,
  action_id uuid references public.actions(id) on delete cascade,
  type text not null check (type in (
    'validated',
    'action_proposed',
    'edited',
    'approved',
    'cancelled',
    'email_sent',
    'email_failed'
  )),
  summary text not null check (char_length(summary) between 1 and 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  check ((type = 'validated' and analysis_id is not null) or (type <> 'validated' and action_id is not null))
);

create index activity_events_enquiry_created_at_idx
  on public.activity_events (enquiry_id, created_at desc);

create unique index activity_events_analysis_validated_idx
  on public.activity_events (analysis_id, type)
  where type = 'validated';

create unique index activity_events_action_singletons_idx
  on public.activity_events (action_id, type)
  where type in ('action_proposed', 'approved', 'cancelled', 'email_sent');

alter table public.activity_events enable row level security;

revoke all on table public.activity_events from anon, authenticated;
grant select, insert on table public.activity_events to service_role;

-- Review state and its audit event commit together; the browser cannot invoke this function.
create function public.record_action_review(
  p_action_id uuid,
  p_enquiry_id text,
  p_operation text,
  p_payload jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action_id uuid;
begin
  if p_operation = 'save_edit' then
    update public.actions
    set payload = p_payload, status = 'edited', updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status in ('proposed', 'edited')
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (enquiry_id, action_id, type, summary)
      values (p_enquiry_id, v_action_id, 'edited', 'The draft reply was edited and saved.');
    end if;
  elsif p_operation = 'cancel' then
    update public.actions
    set payload = p_payload, status = 'cancelled', rejected_at = now(), updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status in ('proposed', 'edited')
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (enquiry_id, action_id, type, summary)
      values (p_enquiry_id, v_action_id, 'cancelled', 'The proposed draft reply was cancelled. No email was sent.');
    end if;
  else
    raise exception 'Unsupported review operation';
  end if;

  return v_action_id is not null;
end;
$$;

-- Only one request can claim initial execution or an explicit safe retry.
create function public.claim_action_execution(
  p_action_id uuid,
  p_enquiry_id text,
  p_operation text,
  p_payload jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action_id uuid;
begin
  if p_operation = 'approve' then
    update public.actions
    set payload = p_payload,
        status = 'approved',
        approved_by_user_at = now(),
        execution_status = 'pending',
        execution_started_at = now(),
        error_message = null,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status in ('proposed', 'edited')
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (enquiry_id, action_id, type, summary, details)
      values (
        p_enquiry_id,
        v_action_id,
        'approved',
        'The draft reply was approved for controlled test execution.',
        '{"executionStatus":"pending"}'::jsonb
      );
    end if;
  elsif p_operation = 'retry_execution' then
    update public.actions
    set execution_status = 'pending',
        execution_started_at = now(),
        error_message = null,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status = 'approved'
      and (
        execution_status = 'failed'
        or (execution_status = 'pending' and execution_started_at is null)
      )
    returning id into v_action_id;
  else
    raise exception 'Unsupported execution operation';
  end if;

  return v_action_id is not null;
end;
$$;

-- Delivery result and its audit event commit together.
create function public.finalize_action_execution(
  p_action_id uuid,
  p_enquiry_id text,
  p_execution_started_at timestamptz,
  p_result text,
  p_provider_message_id text default null,
  p_failure_category text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action_id uuid;
begin
  if p_result = 'succeeded' then
    update public.actions
    set execution_status = 'succeeded',
        provider_message_id = p_provider_message_id,
        executed_at = now(),
        error_message = null,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status = 'approved'
      and execution_status = 'pending'
      and execution_started_at = p_execution_started_at
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (enquiry_id, action_id, type, summary, details)
      values (
        p_enquiry_id,
        v_action_id,
        'email_sent',
        'The approved draft was sent to the configured test inbox.',
        '{"executionStatus":"succeeded"}'::jsonb
      );
    end if;
  elsif p_result = 'failed' then
    update public.actions
    set execution_status = 'failed',
        error_message = p_failure_category,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status = 'approved'
      and execution_status = 'pending'
      and execution_started_at = p_execution_started_at
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (enquiry_id, action_id, type, summary, details)
      values (
        p_enquiry_id,
        v_action_id,
        'email_failed',
        'Email execution failed before delivery.',
        jsonb_build_object('executionStatus', 'failed', 'failureCategory', p_failure_category)
      );
    end if;
  elsif p_result = 'indeterminate' then
    update public.actions
    set error_message = 'outcome_unknown', updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and status = 'approved'
      and execution_status = 'pending'
      and execution_started_at = p_execution_started_at
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (enquiry_id, action_id, type, summary, details)
      values (
        p_enquiry_id,
        v_action_id,
        'email_failed',
        'The email provider outcome could not be confirmed; automatic retry is blocked.',
        '{"executionStatus":"pending","failureCategory":"outcome_unknown"}'::jsonb
      );
    end if;
  else
    raise exception 'Unsupported execution result';
  end if;

  return v_action_id is not null;
end;
$$;

revoke all on function public.record_action_review(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_action_execution(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_action_execution(uuid, text, timestamptz, text, text, text) from public, anon, authenticated;

grant execute on function public.record_action_review(uuid, text, text, jsonb) to service_role;
grant execute on function public.claim_action_execution(uuid, text, text, jsonb) to service_role;
grant execute on function public.finalize_action_execution(uuid, text, timestamptz, text, text, text) to service_role;
