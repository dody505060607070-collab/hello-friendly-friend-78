GRANT INSERT ON public.backup_runs TO authenticated;

DROP POLICY IF EXISTS "admins log backups" ON public.backup_runs;
CREATE POLICY "admins log backups" ON public.backup_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));