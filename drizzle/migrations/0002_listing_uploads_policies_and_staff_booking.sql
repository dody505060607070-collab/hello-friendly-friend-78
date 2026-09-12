drop policy if exists "public upload listing images" on storage.objects;
create policy "public upload listing images"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'listing-uploads');

drop policy if exists "staff read listing images" on storage.objects;
create policy "staff read listing images"
on storage.objects for select to authenticated
using (bucket_id = 'listing-uploads' and public.is_staff(auth.uid()));

drop policy if exists "create reservations" on public.reservations;
create policy "create reservations"
on public.reservations for insert to authenticated
with check (public.is_staff(auth.uid()));

drop policy if exists "edit reservations" on public.reservations;
create policy "edit reservations"
on public.reservations for update to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists "view reservations" on public.reservations;
create policy "view reservations"
on public.reservations for select to authenticated
using (public.is_staff(auth.uid()));