alter table public.activity_log
  add constraint activity_log_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;