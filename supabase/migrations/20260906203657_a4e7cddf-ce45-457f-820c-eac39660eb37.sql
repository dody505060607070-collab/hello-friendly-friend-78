CREATE POLICY "staff read property media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'property-media' AND public.is_staff(auth.uid()));
CREATE POLICY "staff write property media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-media' AND public.has_perm(auth.uid(),'properties','edit'));
CREATE POLICY "staff update property media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-media' AND public.has_perm(auth.uid(),'properties','edit'));
CREATE POLICY "staff delete property media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-media' AND public.has_perm(auth.uid(),'properties','edit'));

CREATE POLICY "staff read contract files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-files' AND public.has_perm(auth.uid(),'contracts','view'));
CREATE POLICY "staff write contract files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-files' AND public.has_perm(auth.uid(),'contracts','edit'));
CREATE POLICY "staff delete contract files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-files' AND public.has_perm(auth.uid(),'contracts','delete'));

CREATE POLICY "staff read internal files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'internal-files' AND public.is_staff(auth.uid()));
CREATE POLICY "staff write internal files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'internal-files' AND public.is_staff(auth.uid()));
CREATE POLICY "staff delete internal files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'internal-files' AND public.is_staff(auth.uid()));