CREATE POLICY "auth read visible properties" ON public.properties FOR SELECT TO authenticated USING (is_visible);
CREATE POLICY "auth read images of visible properties" ON public.property_images FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible));
CREATE POLICY "auth read videos of visible properties" ON public.property_videos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible));
CREATE POLICY "auth read guarantees of visible properties" ON public.property_guarantees FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible));
CREATE POLICY "auth read active services" ON public.services FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "auth read active partners" ON public.partners FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "auth read settings public" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read cities" ON public.cities FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "auth read districts" ON public.districts FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "auth read property types" ON public.property_types FOR SELECT TO authenticated USING (is_active);
GRANT INSERT ON public.listing_requests, public.supply_requests TO anon;