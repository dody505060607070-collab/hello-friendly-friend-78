GRANT SELECT ON public.properties, public.property_images, public.property_videos, public.property_guarantees, public.services, public.partners, public.app_settings, public.cities, public.districts, public.property_types TO anon;

CREATE POLICY "public read images of visible properties" ON public.property_images FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible AND p.status = 'available'));

CREATE POLICY "public read videos of visible properties" ON public.property_videos FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible AND p.status = 'available'));

CREATE POLICY "public read guarantees of visible properties" ON public.property_guarantees FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible AND p.status = 'available'));

CREATE POLICY "public read active services" ON public.services FOR SELECT TO anon USING (is_active);
CREATE POLICY "public read active partners" ON public.partners FOR SELECT TO anon USING (is_active);
CREATE POLICY "public read settings" ON public.app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "public read cities" ON public.cities FOR SELECT TO anon USING (is_active);
CREATE POLICY "public read districts" ON public.districts FOR SELECT TO anon USING (is_active);
CREATE POLICY "public read property types" ON public.property_types FOR SELECT TO anon USING (is_active);