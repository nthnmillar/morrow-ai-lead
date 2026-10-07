-- Supabase/PostgREST requires SELECT as well as INSERT for the enquiry upsert.
grant select on table public.enquiries to service_role;