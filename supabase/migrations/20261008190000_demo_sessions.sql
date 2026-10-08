alter table public.analyses add column demo_session_id uuid;
alter table public.actions add column demo_session_id uuid;
alter table public.activity_events add column demo_session_id uuid;

-- Earlier private development rows remain intact but are not visible to anonymous demo sessions.
create index analyses_demo_session_enquiry_created_at_idx
  on public.analyses (demo_session_id, enquiry_id, created_at desc);
create index actions_demo_session_id_idx
  on public.actions (demo_session_id, id);
create index activity_events_demo_session_created_at_idx
  on public.activity_events (demo_session_id, created_at desc);
create index activity_events_demo_session_enquiry_created_at_idx
  on public.activity_events (demo_session_id, enquiry_id, created_at desc);

alter table public.actions add column execution_mode text;
update public.actions
set execution_mode = 'resend'
where execution_status is not null;

alter table public.actions drop constraint actions_execution_state_check;
alter table public.actions add constraint actions_execution_mode_check check (
  (status <> 'approved' and execution_mode is null)
  or (status = 'approved' and execution_mode in ('demo', 'resend'))
);
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
    and executed_at is not null
    and error_message is null
    and (
      (execution_mode = 'demo' and provider_message_id is null)
      or (execution_mode = 'resend' and provider_message_id is not null)
    )
  )
  or (
    status = 'approved'
    and execution_status = 'failed'
    and execution_started_at is not null
    and provider_message_id is null
    and executed_at is null
    and execution_mode = 'resend'
    and error_message in ('configuration_missing', 'provider_rejected')
  )
);

alter table public.activity_events drop constraint activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check check (type in (
  'validated',
  'action_proposed',
  'edited',
  'approved',
  'cancelled',
  'email_sent',
  'email_simulated',
  'email_failed'
));

drop index public.activity_events_action_singletons_idx;
create unique index activity_events_action_singletons_idx
  on public.activity_events (action_id, type)
  where type in ('action_proposed', 'approved', 'cancelled', 'email_sent', 'email_simulated');

drop function public.record_action_review(uuid, text, text, jsonb);
drop function public.claim_action_execution(uuid, text, text, jsonb);
drop function public.finalize_action_execution(uuid, text, timestamptz, text, text, text);

create function public.record_action_review(
  p_demo_session_id uuid,
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
      and demo_session_id = p_demo_session_id
      and status in ('proposed', 'edited')
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (demo_session_id, enquiry_id, action_id, type, summary)
      values (p_demo_session_id, p_enquiry_id, v_action_id, 'edited', 'The draft reply was edited and saved.');
    end if;
  elsif p_operation = 'cancel' then
    update public.actions
    set payload = p_payload, status = 'cancelled', rejected_at = now(), updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and demo_session_id = p_demo_session_id
      and status in ('proposed', 'edited')
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (demo_session_id, enquiry_id, action_id, type, summary)
      values (p_demo_session_id, p_enquiry_id, v_action_id, 'cancelled', 'The proposed draft reply was cancelled. No email was sent.');
    end if;
  else
    raise exception 'Unsupported review operation';
  end if;

  return v_action_id is not null;
end;
$$;

create function public.claim_action_execution(
  p_demo_session_id uuid,
  p_action_id uuid,
  p_enquiry_id text,
  p_operation text,
  p_payload jsonb,
  p_execution_mode text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action_id uuid;
begin
  if p_execution_mode not in ('demo', 'resend') then
    raise exception 'Unsupported execution mode';
  end if;

  if p_operation = 'approve' then
    update public.actions
    set payload = p_payload,
        status = 'approved',
        approved_by_user_at = now(),
        execution_mode = p_execution_mode,
        execution_status = 'pending',
        execution_started_at = now(),
        error_message = null,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and demo_session_id = p_demo_session_id
      and status in ('proposed', 'edited')
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (demo_session_id, enquiry_id, action_id, type, summary, details)
      values (
        p_demo_session_id,
        p_enquiry_id,
        v_action_id,
        'approved',
        case when p_execution_mode = 'demo'
          then 'The draft reply was approved for simulated execution.'
          else 'The draft reply was approved for controlled test execution.'
        end,
        jsonb_build_object('executionStatus', 'pending', 'executionMode', p_execution_mode)
      );
    end if;
  elsif p_operation = 'retry_execution' then
    update public.actions
    set execution_mode = p_execution_mode,
        execution_status = 'pending',
        execution_started_at = now(),
        error_message = null,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and demo_session_id = p_demo_session_id
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

create function public.finalize_action_execution(
  p_demo_session_id uuid,
  p_action_id uuid,
  p_enquiry_id text,
  p_execution_started_at timestamptz,
  p_execution_mode text,
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
    if (p_execution_mode = 'demo' and p_provider_message_id is not null)
      or (p_execution_mode = 'resend' and p_provider_message_id is null)
      or p_execution_mode not in ('demo', 'resend') then
      raise exception 'Invalid successful execution result';
    end if;

    update public.actions
    set execution_status = 'succeeded',
        provider_message_id = p_provider_message_id,
        executed_at = now(),
        error_message = null,
        updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and demo_session_id = p_demo_session_id
      and status = 'approved'
      and execution_mode = p_execution_mode
      and execution_status = 'pending'
      and execution_started_at = p_execution_started_at
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (demo_session_id, enquiry_id, action_id, type, summary, details)
      values (
        p_demo_session_id,
        p_enquiry_id,
        v_action_id,
        case when p_execution_mode = 'demo' then 'email_simulated' else 'email_sent' end,
        case when p_execution_mode = 'demo'
          then 'Email simulated successfully'
          else 'The approved draft was sent to the configured test inbox.'
        end,
        jsonb_build_object('executionStatus', 'succeeded', 'executionMode', p_execution_mode)
      );
    end if;
  elsif p_result = 'failed' and p_execution_mode = 'resend' then
    update public.actions
    set execution_status = 'failed', error_message = p_failure_category, updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and demo_session_id = p_demo_session_id
      and status = 'approved'
      and execution_mode = 'resend'
      and execution_status = 'pending'
      and execution_started_at = p_execution_started_at
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (demo_session_id, enquiry_id, action_id, type, summary, details)
      values (
        p_demo_session_id,
        p_enquiry_id,
        v_action_id,
        'email_failed',
        'Email execution failed before delivery.',
        jsonb_build_object('executionStatus', 'failed', 'executionMode', 'resend', 'failureCategory', p_failure_category)
      );
    end if;
  elsif p_result = 'indeterminate' and p_execution_mode = 'resend' then
    update public.actions
    set error_message = 'outcome_unknown', updated_at = now()
    where id = p_action_id
      and enquiry_id = p_enquiry_id
      and demo_session_id = p_demo_session_id
      and status = 'approved'
      and execution_mode = 'resend'
      and execution_status = 'pending'
      and execution_started_at = p_execution_started_at
    returning id into v_action_id;

    if v_action_id is not null then
      insert into public.activity_events (demo_session_id, enquiry_id, action_id, type, summary, details)
      values (
        p_demo_session_id,
        p_enquiry_id,
        v_action_id,
        'email_failed',
        'The email provider outcome could not be confirmed; automatic retry is blocked.',
        '{"executionStatus":"pending","executionMode":"resend","failureCategory":"outcome_unknown"}'::jsonb
      );
    end if;
  else
    raise exception 'Unsupported execution result';
  end if;

  return v_action_id is not null;
end;
$$;

revoke all on function public.record_action_review(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_action_execution(uuid, uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.finalize_action_execution(uuid, uuid, text, timestamptz, text, text, text, text) from public, anon, authenticated;

grant execute on function public.record_action_review(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.claim_action_execution(uuid, uuid, text, text, jsonb, text) to service_role;
grant execute on function public.finalize_action_execution(uuid, uuid, text, timestamptz, text, text, text, text) to service_role;
