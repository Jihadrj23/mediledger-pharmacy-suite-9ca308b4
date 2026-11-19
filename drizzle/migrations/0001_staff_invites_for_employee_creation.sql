create table public.staff_invites (
  email text primary key,
  role public.app_role not null default 'cashier',
  created_by uuid,
  created_at timestamptz not null default now()
);
grant all on public.staff_invites to service_role;
alter table public.staff_invites enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _role public.app_role; _invite public.staff_invites%rowtype;
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    _role := 'admin';
  else
    select * into _invite from public.staff_invites where email = lower(new.email);
    if not found then
      raise exception 'Public sign-up is disabled. Ask the pharmacy owner to create your account.';
    end if;
    _role := _invite.role;
    delete from public.staff_invites where email = _invite.email;
  end if;
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email);
  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end $$;