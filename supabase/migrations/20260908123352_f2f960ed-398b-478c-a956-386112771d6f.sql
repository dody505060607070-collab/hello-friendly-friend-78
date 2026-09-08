
create or replace function public.bootstrap_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uemail text;
  uname text;
  is_first boolean;
begin
  if uid is null then return; end if;
  if exists (select 1 from public.client_accounts ca where ca.user_id = uid) then return; end if;

  select email, coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1))
    into uemail, uname from auth.users where id = uid;

  insert into public.profiles (id, full_name, email, is_active)
  values (uid, coalesce(uname,'مستخدم'), uemail, true)
  on conflict (id) do nothing;

  select not exists (
    select 1 from public.user_roles where role = 'super_admin'
  ) into is_first;

  if is_first then
    insert into public.user_roles (user_id, role) values (uid, 'super_admin')
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.bootstrap_current_user() to authenticated;

insert into public.profiles (id, full_name, email, is_active)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@','1'::int)), u.email, true
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (select 1 from public.client_accounts c where c.user_id = u.id)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::app_role
from auth.users u
where not exists (select 1 from public.user_roles r where r.role = 'super_admin')
order by u.created_at
limit 1;
