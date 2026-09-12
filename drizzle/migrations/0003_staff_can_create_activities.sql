drop policy if exists "admins manage activities" on public.employee_activities;
create policy "staff create activities"
on public.employee_activities for insert to authenticated
with check (public.is_staff(auth.uid()));

drop policy if exists "admin or assignee update activities" on public.employee_activities;
create policy "admin assignee or creator update activities"
on public.employee_activities for update to authenticated
using (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  or employee_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  or employee_id = auth.uid()
  or created_by = auth.uid()
);