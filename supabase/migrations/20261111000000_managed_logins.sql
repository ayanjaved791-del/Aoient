-- ───────────── Logins created by an organization for its staff ─────────────
-- must_change_password: the person must choose their own password at next sign-in
--   (set when an admin creates the login or sets a temporary password).
-- password_changed_at: when the person last chose a password themselves.
-- managed_by_organization_id: the organization that created this login. Only it
--   may later set a temporary password, and only while the person belongs to no
--   other organization.
alter table public.profile
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists managed_by_organization_id uuid references public.organization (id) on delete set null;

-- When someone changes their own name or sign-in email, their linked employee
-- records follow (name always; work email only where it was the old sign-in email).
create or replace function public.sync_employee_from_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name and nullif(trim(new.name), '') is not null then
    update public.employee e set full_name = new.name, updated_at = now()
    from public.organization_member m
    where m.id = e.member_id and m.user_id = new.id;
  end if;
  if new.email is distinct from old.email then
    update public.employee e set work_email = new.email, updated_at = now()
    from public.organization_member m
    where m.id = e.member_id and m.user_id = new.id and lower(e.work_email) = lower(old.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_changed_sync_employee on public.profile;
create trigger on_profile_changed_sync_employee
  after update of name, email on public.profile
  for each row execute function public.sync_employee_from_profile();
