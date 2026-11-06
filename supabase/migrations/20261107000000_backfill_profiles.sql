-- Creates profiles for auth users that signed up before the profile trigger
-- existed (e.g. accounts made before the first migration was applied).
-- Without a profile the app treats the user as signed out.
insert into public.profile (id, name, email, email_verified)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
  lower(u.email),
  u.email_confirmed_at is not null
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profile p where p.id = u.id)
  and not exists (select 1 from public.profile p where lower(p.email) = lower(u.email))
on conflict (id) do nothing;

update public.profile p
set email_verified = true, updated_at = now()
from auth.users u
where u.id = p.id and u.email_confirmed_at is not null and not p.email_verified;
