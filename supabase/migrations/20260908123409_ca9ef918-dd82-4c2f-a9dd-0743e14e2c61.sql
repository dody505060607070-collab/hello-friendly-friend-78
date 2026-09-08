revoke all on function public.bootstrap_current_user() from public, anon;
grant execute on function public.bootstrap_current_user() to authenticated;