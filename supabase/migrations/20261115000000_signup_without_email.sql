-- ───────────── Sign-up when Supabase can't send the confirmation email ─────────────
-- Supabase's built-in email service only delivers to the project's own team and
-- a few emails an hour. When it refuses, Aoient creates the login on the server
-- instead (Supabase admin API, service-role key) and marks it in app_metadata
-- (which only the server can write) as `aoient_email_unproven`.
--
-- Such a person can sign in, create their own organization and accept an
-- invitation link addressed to their email, but `email_verified` stays false:
-- nothing that relies on owning the inbox (finding invitations by email alone)
-- is open to them.
alter table public.profile add column if not exists email_unproven boolean not null default false;

create or replace function public.sync_profile_from_auth() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  unproven boolean := coalesce((to_jsonb(new) -> 'raw_app_meta_data' ->> 'aoient_email_unproven')::boolean, false);
begin
  insert into public.profile (id, name, email, email_verified, email_unproven)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    new.email_confirmed_at is not null and not unproven,
    unproven
  )
  on conflict (id) do update set
    email = excluded.email,
    email_verified = excluded.email_verified,
    email_unproven = excluded.email_unproven,
    name = case when nullif(trim(new.raw_user_meta_data ->> 'name'), '') is not null
                then excluded.name else public.profile.name end,
    updated_at = now();
  return new;
end;
$$;
