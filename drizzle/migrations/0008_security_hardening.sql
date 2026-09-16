DROP POLICY IF EXISTS "staff read automation config" ON public.automation_config;
REVOKE SELECT ON public.automation_config FROM authenticated, anon;

REVOKE ALL ON FUNCTION public.bootstrap_current_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_activity(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_perm(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_task_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_org(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bootstrap_current_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_activity(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_perm(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_task_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_org(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_reservation_overlap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_contract_tasks() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "public upload listing images" ON storage.objects;
CREATE POLICY "public upload listing images"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'listing-uploads'
  AND (storage.foldername(name))[1] = 'public'
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','heic','avif')
  AND length(name) < 200
);

ALTER TABLE public.listing_requests
  ADD CONSTRAINT listing_requests_text_limits CHECK (
    length(coalesce(full_name, '')) <= 120
    AND length(coalesce(phone, '')) <= 30
    AND length(coalesce(description, '')) <= 3000
    AND length(coalesce(map_url, '')) <= 600
  ) NOT VALID;

ALTER TABLE public.supply_requests
  ADD CONSTRAINT supply_requests_text_limits CHECK (
    length(coalesce(full_name, '')) <= 120
    AND length(coalesce(phone, '')) <= 30
    AND length(coalesce(requester_notes, '')) <= 3000
  ) NOT VALID;